const crypto = require('crypto');
const samlify = require('samlify');
const { DOMParser } = require('@xmldom/xmldom');
const { clean } = require('./_supabase');

// Serverless functions have no xmllint binary available, and samlify's
// schema validation is optional — skip it rather than shipping a native
// dependency just to re-check what signature verification already covers.
samlify.setSchemaValidator({ validate: () => Promise.resolve('skip') });

const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://studentperks.co.za').replace(/\/$/, '');
const SP_ENTITY_ID = process.env.SAFIRE_SP_ENTITY_ID || `${SITE_ORIGIN}/api/saml/metadata`;
const ACS_URL = process.env.SAFIRE_SP_ACS_URL || `${SITE_ORIGIN}/api/saml/acs`;
const IDP_METADATA_URL = process.env.SAFIRE_IDP_METADATA_URL || 'https://metadata.safire.ac.za/safire-hub-metadata.xml';
const IDP_METADATA_CACHE_MS = 6 * 60 * 60 * 1000; // matches the federation's own cacheDuration (PT6H)

function normalizePem(value) {
  // Vercel env vars are single-line, so PEM blocks are usually stored with
  // literal "\n" escapes that need turning back into real newlines.
  return value ? String(value).replace(/\\n/g, '\n').trim() : '';
}

const SP_PRIVATE_KEY = normalizePem(process.env.SAFIRE_SP_PRIVATE_KEY);
const SP_CERT = normalizePem(process.env.SAFIRE_SP_CERT);

function hasSpCredentials() {
  return Boolean(SP_PRIVATE_KEY && SP_CERT);
}

let spInstance = null;
function getServiceProvider() {
  if (!hasSpCredentials()) return null;
  if (spInstance) return spInstance;
  spInstance = samlify.ServiceProvider({
    entityID: SP_ENTITY_ID,
    // The SAFIRE hub's IdP metadata doesn't advertise WantAuthnRequestsSigned,
    // which samlify treats as false — this must match or createLoginRequest
    // throws ERR_METADATA_CONFLICT_REQUEST_SIGNED_FLAG.
    authnRequestsSigned: false,
    wantAssertionsSigned: true,
    wantMessageSigned: false,
    signingCert: SP_CERT,
    privateKey: SP_PRIVATE_KEY,
    // Same keypair does double duty for encryption — SAFIRE's SP
    // requirements just check that an encryption key is published, and a
    // second dedicated keypair isn't worth the extra rotation surface here.
    encryptCert: SP_CERT,
    encPrivateKey: SP_PRIVATE_KEY,
    // SAFIRE's validator flags an SP that only advertises the legacy SAML
    // 1.1 emailAddress format (samlify's default); SAFIRE's reviewed
    // metadata keeps just transient.
    nameIDFormat: ['urn:oasis:names:tc:SAML:2.0:nameid-format:transient'],
    assertionConsumerService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: ACS_URL
    }]
  });
  return spInstance;
}

// The SAFIRE hub publishes its certificates in <KeyDescriptor> elements
// with no use="..." attribute, which per saml-metadata §2.4.1.1 means the key
// is for both signing and encryption. samlify only reads certificates
// explicitly marked use="signing" for signature checks, so without this it
// finds none and every login fails inside verifySignature with "Cannot
// read properties of null (reading 'map')". Each unmarked KeyDescriptor is
// split into an explicit signing and encryption copy before parsing.
function expandUnspecifiedKeyUse(xml) {
  return xml.replace(
    /<((?:[A-Za-z0-9_-]+:)?)KeyDescriptor>([\s\S]*?)<\/\1KeyDescriptor>/g,
    (match, prefix, inner) =>
      `<${prefix}KeyDescriptor use="signing">${inner}</${prefix}KeyDescriptor>` +
      `<${prefix}KeyDescriptor use="encryption">${inner}</${prefix}KeyDescriptor>`
  );
}

let idpCache = { instance: null, fetchedAt: 0 };
async function getIdentityProvider() {
  const now = Date.now();
  if (idpCache.instance && now - idpCache.fetchedAt < IDP_METADATA_CACHE_MS) {
    return idpCache.instance;
  }
  const response = await fetch(IDP_METADATA_URL);
  if (!response.ok) {
    throw new Error(`Could not fetch SAFIRE IdP metadata (HTTP ${response.status}).`);
  }
  const xml = expandUnspecifiedKeyUse(await response.text());
  const instance = samlify.IdentityProvider({ metadata: xml });
  idpCache = { instance, fetchedAt: now };
  return instance;
}

async function readFormBody(req) {
  if (typeof req.body === 'object' && req.body && !Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const params = new URLSearchParams(raw);
  const body = {};
  for (const [key, value] of params) body[key] = value;
  return body;
}

// Maps the institution dropdown values in index.html to each institution's
// IdP entityID as the SAFIRE hub knows it (the idpentityid values on the
// hub's own discovery page, https://iziko.safire.ac.za). createLoginRedirectUrl
// puts this in a <Scoping><IDPList> in the AuthnRequest, which makes the
// hub skip its institution picker and send the student straight to their
// own university's login. These are the institutions' real entityIDs, not
// the proxy.safire.ac.za/birk.php/... aliases (those are for SPs connecting
// outside the hub; the hub answers "None of the IdPs requested are
// supported by this proxy" to them). Institutions not listed here fall back
// to the hub's picker.
const INSTITUTION_IDP_MAP = {
  'University of Cape Town (UCT)': 'https://srvslsfed001.uct.ac.za/simplesaml/saml2/idp/metadata.php',
  'University of the Witwatersrand (Wits)': 'https://idp.wits.ac.za/safss/saml2/idp/metadata.php',
  'Stellenbosch University (SU)': 'http://federate.sun.ac.za/adfs/services/trust',
  'University of Pretoria (UP)': 'https://www1.up.ac.za:443/oam/fed',
  'University of KwaZulu-Natal (UKZN)': 'http://federation.ukzn.ac.za/adfs/services/trust',
  'North-West University (NWU)': 'https://shib.nwu.ac.za/idp/shibboleth',
  'University of the Western Cape (UWC)': 'https://saml.uwc.ac.za/simplesaml/saml2/idp/metadata.php',
  'Rhodes University': 'https://login.ru.ac.za/idp/shibboleth',
  'University of Venda': 'https://sts.windows.net/f38ba9d8-554c-48a2-ae42-13b1e7f3c797/',
  'University of Fort Hare': 'http://federate.ufh.ac.za/adfs/services/trust',
  'Walter Sisulu University (WSU)': 'https://idp.wsu.ac.za/simplesaml/saml2/idp/metadata.php',
  'Sol Plaatje University': 'https://sts.windows.net/acbcaed8-7adc-460c-ba57-028bdc80d84a/',
  'Cape Peninsula University of Technology (CPUT)': 'https://sts.windows.net/cc6148eb-d356-4f38-900f-3a4d62b954c8/',
  'Durban University of Technology (DUT)': 'https://sts.windows.net/4b1930d1-12f4-40b5-b48c-bd86117429d8/',
  'Tshwane University of Technology (TUT)': 'https://sts.windows.net/3df74539-9453-4d03-bb9d-b9102cb9ce9c/',
  'Vaal University of Technology (VUT)': 'http://logmein.vut.ac.za/adfs/services/trust',
  'Central University of Technology (CUT)': 'http://logon.cut.ac.za/adfs/services/trust',
  'Nelson Mandela University (NMU)': 'https://nmmusaml-sc1.nmmu.ac.za/simplesaml/saml2/idp/metadata.php',
  'University of the Free State (UFS)': 'http://safire.ufs.ac.za/adfs/services/trust',
  // Zululand publishes separate staff and student logins; students go to the student one.
  'University of Zululand': 'https://sts.windows.net/543f2205-fcdc-4c35-ad7a-ea6bd74ca885/',
  'University of Mpumalanga': 'https://sts.windows.net/bc5fec91-045a-4917-906e-43922049f31d/',
  'George Whitefield College': 'https://sauth1.gwc.ac.za/realms/gwc',
  'South African Theological Seminary': 'https://sso.sats.edu.za/'
};

// Friendly institution names for the domain (scope) in a student's
// eduPersonScopedAffiliation, from the shibmd:Scope values each institution
// publishes in SAFIRE metadata. A scope matches its domain or any subdomain
// (e.g. students.wits.ac.za -> Wits). Unknown scopes keep the raw domain.
const SCOPE_INSTITUTIONS = [
  ['uct.ac.za', 'University of Cape Town (UCT)'],
  ['wits.ac.za', 'University of the Witwatersrand (Wits)'],
  ['sun.ac.za', 'Stellenbosch University (SU)'],
  ['up.ac.za', 'University of Pretoria (UP)'],
  ['ukzn.ac.za', 'University of KwaZulu-Natal (UKZN)'],
  ['nwu.ac.za', 'North-West University (NWU)'],
  ['mandela.ac.za', 'Nelson Mandela University (NMU)'],
  ['nmmu.ac.za', 'Nelson Mandela University (NMU)'],
  ['ufs.ac.za', 'University of the Free State (UFS)'],
  ['uwc.ac.za', 'University of the Western Cape (UWC)'],
  ['myuwc.ac.za', 'University of the Western Cape (UWC)'],
  ['ru.ac.za', 'Rhodes University'],
  ['univen.ac.za', 'University of Venda'],
  ['ufh.ac.za', 'University of Fort Hare'],
  ['wsu.ac.za', 'Walter Sisulu University (WSU)'],
  ['mywsu.ac.za', 'Walter Sisulu University (WSU)'],
  ['spu.ac.za', 'Sol Plaatje University'],
  ['unizulu.ac.za', 'University of Zululand'],
  ['ump.ac.za', 'University of Mpumalanga'],
  ['cput.ac.za', 'Cape Peninsula University of Technology (CPUT)'],
  ['mycput.ac.za', 'Cape Peninsula University of Technology (CPUT)'],
  ['dut.ac.za', 'Durban University of Technology (DUT)'],
  ['dut4life.ac.za', 'Durban University of Technology (DUT)'],
  ['tut.ac.za', 'Tshwane University of Technology (TUT)'],
  ['tut4life.ac.za', 'Tshwane University of Technology (TUT)'],
  ['vut.ac.za', 'Vaal University of Technology (VUT)'],
  ['cut.ac.za', 'Central University of Technology (CUT)'],
  ['gwc.ac.za', 'George Whitefield College'],
  ['sats.ac.za', 'South African Theological Seminary'],
  ['sats.edu.za', 'South African Theological Seminary'],
  ['testidp.safire.ac.za', 'SAFIRE Test Identity Provider']
];

function institutionFromScope(scope) {
  const s = clean(scope).toLowerCase();
  if (!s) return '';
  const hit = SCOPE_INSTITUTIONS.find(([domain]) => s === domain || s.endsWith(`.${domain}`));
  return hit ? hit[1] : s;
}

const ATTRIBUTE_KEYS = {
  mail: ['mail', 'urn:oid:0.9.2342.19200300.100.1.3', 'email'],
  eppn: ['eduPersonPrincipalName', 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6'],
  displayName: ['displayName', 'urn:oid:2.16.840.1.113730.3.1.241'],
  givenName: ['givenName', 'urn:oid:2.5.4.42'],
  sn: ['sn', 'surname', 'urn:oid:2.5.4.4'],
  scopedAffiliation: ['eduPersonScopedAffiliation', 'urn:oid:1.3.6.1.4.1.5923.1.1.1.9'],
  affiliation: ['eduPersonAffiliation', 'urn:oid:1.3.6.1.4.1.5923.1.1.1.1'],
  schacHomeOrganization: ['schacHomeOrganization', 'urn:oid:1.3.6.1.4.1.25178.1.2.9'],
  targetedId: ['eduPersonTargetedID', 'urn:oid:1.3.6.1.4.1.5923.1.1.1.10']
};

function firstValue(attrs, keys) {
  for (const key of keys) {
    const value = attrs[key];
    if (value === undefined || value === null || value === '') continue;
    return clean(Array.isArray(value) ? value[0] : value);
  }
  return '';
}

function allValues(attrs, keys) {
  for (const key of keys) {
    const value = attrs[key];
    if (value === undefined || value === null) continue;
    return (Array.isArray(value) ? value : [value]).map(clean).filter(Boolean);
  }
  return [];
}

// Builds a normalized student profile from a verified SAML assertion's
// attribute map (per https://safire.ac.za/technical/attributes/).
function extractStudentProfile(attributes) {
  const attrs = attributes || {};
  // SAFIRE has confirmed (2026-09) that IdPs won't release an untargeted
  // identifier — eduPersonPrincipalName or subject-id — for the "student
  // discount validation" use case, precisely because it's a stable
  // cross-service identifier and this is a low-trust commercial use.
  // eppn is kept as a defensive fallback only; mail is the real source,
  // requested with explicit motivation on the SP registration form.
  const eppn = firstValue(attrs, ATTRIBUTE_KEYS.eppn);
  const mail = firstValue(attrs, ATTRIBUTE_KEYS.mail) || (eppn.includes('@') ? eppn : '');
  const targetedId = firstValue(attrs, ATTRIBUTE_KEYS.targetedId);
  const givenName = firstValue(attrs, ATTRIBUTE_KEYS.givenName);
  const sn = firstValue(attrs, ATTRIBUTE_KEYS.sn);
  const displayName = firstValue(attrs, ATTRIBUTE_KEYS.displayName) || [givenName, sn].filter(Boolean).join(' ');
  const scopedAffiliations = allValues(attrs, ATTRIBUTE_KEYS.scopedAffiliation);
  const affiliations = allValues(attrs, ATTRIBUTE_KEYS.affiliation);
  const allAffiliations = scopedAffiliations.concat(affiliations);
  const isStudent = allAffiliations.some(value => value.split('@')[0].toLowerCase() === 'student');

  // SAFIRE's advice: derive the home organisation from the scope of the
  // student@<scope> affiliation rather than requesting schacHomeOrganization
  // (a subset of the same information that IdPs release less and less).
  // schacHomeOrganization and eppn are only fallbacks if an IdP sends them.
  const scopeOf = value => (value.includes('@') ? value.split('@')[1].toLowerCase() : '');
  const studentScoped = scopedAffiliations.find(value => value.split('@')[0].toLowerCase() === 'student' && scopeOf(value));
  const anyScoped = scopedAffiliations.find(scopeOf);
  const institution = (studentScoped && scopeOf(studentScoped)) ||
    (anyScoped && scopeOf(anyScoped)) ||
    firstValue(attrs, ATTRIBUTE_KEYS.schacHomeOrganization) ||
    scopeOf(eppn);

  return {
    email: mail.toLowerCase(),
    fullName: displayName,
    institution: institutionFromScope(institution),
    institutionDomain: institution,
    isStudent,
    affiliations: allAffiliations,
    // eduPersonTargetedID is the pseudonymous, SP-specific identifier
    // SAFIRE generates for free (see ATTRIBUTE_KEYS comment above) —
    // stored for audit/dedup purposes since eppn won't be present.
    studentNumber: targetedId || eppn
  };
}

// The SAFIRE hub ignores an idpentityid query parameter on its SSO
// endpoint; it pre-selects an institution from a SAML <Scoping><IDPList>
// inside the AuthnRequest itself (the mechanism SAFIRE's own IdP
// monitoring uses). samlify's default template has no Scoping element, so
// when an institution is known the request XML is built here instead.
function authnRequestWithScoping(idp, idpEntityId) {
  return template => {
    const id = `_${crypto.randomUUID()}`;
    const destination = idp.entityMeta.getSingleSignOnService('redirect');
    const context = template
      .replace('{ID}', id)
      .replace(' ForceAuthn="{ForceAuthn}"', '')
      .replace('{IssueInstant}', new Date().toISOString())
      .replace('{Destination}', escapeXml(destination))
      .replace('{ProtocolBinding}', 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST')
      .replace('{AssertionConsumerServiceURL}', escapeXml(ACS_URL))
      .replace(' AssertionConsumerServiceIndex="{AssertionConsumerServiceIndex}"', '')
      .replace('{Issuer}', escapeXml(SP_ENTITY_ID))
      .replace('{NameIDFormat}', 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient')
      .replace('{AllowCreate}', 'false')
      .replace('</samlp:AuthnRequest>',
        `<samlp:Scoping><samlp:IDPList><samlp:IDPEntry ProviderID="${escapeXml(idpEntityId)}"/></samlp:IDPList></samlp:Scoping></samlp:AuthnRequest>`);
    return { id, context };
  };
}

async function createLoginRedirectUrl(institution, relayState) {
  const sp = getServiceProvider();
  if (!sp) throw new Error('SAML sign-in is not configured yet.');
  const idp = await getIdentityProvider();
  const idpEntityId = INSTITUTION_IDP_MAP[institution];
  const options = {};
  if (relayState) options.relayState = relayState;
  if (idpEntityId) options.customTagReplacement = authnRequestWithScoping(idp, idpEntityId);
  const { context } = sp.createLoginRequest(idp, 'redirect', options);
  return context;
}

// eduPersonTargetedID arrives as a <saml:NameID> nested inside its
// AttributeValue, which samlify's attribute extractor reads as empty. By the
// time this runs samlify has verified the signature (and rejected wrapping
// attacks); reading from the document is only trusted when it holds exactly
// one Assertion, so the value can only come from the signed one.
function readTargetedId(samlContent) {
  if (!samlContent) return '';
  const doc = new DOMParser().parseFromString(String(samlContent), 'text/xml');
  const assertions = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Assertion');
  if (assertions.length !== 1) return '';
  const attrs = assertions[0].getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Attribute');
  for (let i = 0; i < attrs.length; i++) {
    const name = attrs[i].getAttribute('Name');
    if (name !== 'urn:oid:1.3.6.1.4.1.5923.1.1.1.10' && name !== 'eduPersonTargetedID') continue;
    const ids = attrs[i].getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'NameID');
    const value = ids.length ? ids[0].textContent : attrs[i].textContent;
    return clean(value);
  }
  return '';
}

async function parseAcsRequest(req) {
  const sp = getServiceProvider();
  if (!sp) throw new Error('SAML sign-in is not configured yet.');
  const idp = await getIdentityProvider();
  const body = await readFormBody(req);
  const { extract, samlContent } = await sp.parseLoginResponse(idp, 'post', { body });
  const attributes = { ...(extract.attributes || {}) };
  const targetedId = readTargetedId(samlContent);
  if (targetedId) attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.10'] = targetedId;
  return { profile: extractStudentProfile(attributes), relayState: body.RelayState || '' };
}

function escapeXml(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function organizationXml() {
  const name = escapeXml(process.env.SAFIRE_ORG_NAME || 'Fulltime Marketing (Pty) Ltd');
  const url = escapeXml(process.env.SAFIRE_ORG_URL || SITE_ORIGIN);
  return `<Organization><OrganizationName xml:lang="en">${name}</OrganizationName>` +
    `<OrganizationDisplayName xml:lang="en">${name}</OrganizationDisplayName>` +
    `<OrganizationURL xml:lang="en">${url}</OrganizationURL></Organization>`;
}

function contactPersonXml(contactType, name, email) {
  if (!email) return '';
  const nameXml = name ? `<GivenName>${escapeXml(name)}</GivenName>` : '';
  return `<ContactPerson contactType="${contactType}">${nameXml}<EmailAddress>mailto:${escapeXml(email)}</EmailAddress></ContactPerson>`;
}

function securityContactXml(name, email) {
  // REFEDS doesn't define a dedicated SAML contactType, so security
  // contacts use contactType="other" plus a remd:contactType attribute —
  // this exact shape (attribute, not a nested <Extensions> element) is
  // copied from SAFIRE's own published hub metadata, which is what its
  // validator actually expects; see
  // https://refeds.org/category/security-incident-response
  if (!email) return '';
  const nameXml = name ? `<GivenName>${escapeXml(name)}</GivenName>` : '';
  return `<ContactPerson contactType="other" remd:contactType="http://refeds.org/metadata/contactType/security">` +
    `${nameXml}<EmailAddress>mailto:${escapeXml(email)}</EmailAddress></ContactPerson>`;
}

// Attributes published in the SP's <AttributeConsumingService>, exactly as
// in the candidate metadata SAFIRE reviewed (2026-09). schacHomeOrganization
// was dropped on their advice — the home organisation comes from the scope
// of eduPersonScopedAffiliation instead (see extractStudentProfile).
const REQUESTED_ATTRIBUTES = [
  { name: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.9', friendlyName: 'eduPersonScopedAffiliation', required: true },
  { name: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.10', friendlyName: 'eduPersonTargetedID', required: true },
  { name: 'urn:oid:0.9.2342.19200300.100.1.3', friendlyName: 'mail', required: false },
  // Added after registration so the admin dashboard can show students'
  // names; takes effect once SAFIRE re-publishes our metadata.
  { name: 'urn:oid:2.16.840.1.113730.3.1.241', friendlyName: 'displayName', required: false }
];

// Deliberately doesn't mention SAFIRE: students shouldn't need to know the
// federation exists (SAFIRE's own request when reviewing our registration).
const SERVICE_NAME = 'StudentPerks';
const SERVICE_DESCRIPTION = 'Verifies SA student status via their home institution so students can unlock exclusive discounts.';

function uiInfoXml() {
  // <mdui:UIInfo> is what IdPs/the hub show on consent screens. It has to
  // be the first child of SPSSODescriptor (inside <Extensions>). No
  // mdrpi:RegistrationInfo here — SAFIRE adds that itself when publishing.
  const logoUrl = escapeXml(process.env.SAFIRE_LOGO_URL || `${SITE_ORIGIN}/assets/brand/studentperks-logo-hd.svg`);
  const logoWidth = Number(process.env.SAFIRE_LOGO_WIDTH) || 1800;
  const logoHeight = Number(process.env.SAFIRE_LOGO_HEIGHT) || 400;
  return '<Extensions><mdui:UIInfo>' +
    `<mdui:DisplayName xml:lang="en">${escapeXml(SERVICE_NAME)}</mdui:DisplayName>` +
    `<mdui:Description xml:lang="en">${escapeXml(SERVICE_DESCRIPTION)}</mdui:Description>` +
    `<mdui:InformationURL xml:lang="en">${escapeXml(SITE_ORIGIN)}/</mdui:InformationURL>` +
    `<mdui:PrivacyStatementURL xml:lang="en">${escapeXml(SITE_ORIGIN)}/privacy.html</mdui:PrivacyStatementURL>` +
    `<mdui:Logo height="${logoHeight}" width="${logoWidth}">${logoUrl}</mdui:Logo>` +
    '</mdui:UIInfo></Extensions>';
}

function attributeConsumingServiceXml() {
  // Must come after the AssertionConsumerService elements per the SAML
  // metadata schema's sequence for SPSSODescriptor.
  const requested = REQUESTED_ATTRIBUTES.map(attr =>
    `<RequestedAttribute FriendlyName="${attr.friendlyName}" Name="${attr.name}" ` +
    `NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri"${attr.required ? ' isRequired="true"' : ''}/>`
  ).join('');
  return '<AttributeConsumingService index="0">' +
    `<ServiceName xml:lang="en">${escapeXml(SERVICE_NAME)}</ServiceName>` +
    `<ServiceDescription xml:lang="en">${escapeXml(SERVICE_DESCRIPTION)}</ServiceDescription>` +
    `${requested}</AttributeConsumingService>`;
}

function getMetadataXml() {
  const sp = getServiceProvider();
  if (!sp) throw new Error('SAML sign-in is not configured yet.');
  // samlify only declares the namespaces it uses itself, so the REFEDS
  // security-contact extension prefix needs adding at the root — declaring
  // it only on the local <ContactPerson> was rejected as an "unknown
  // namespace" by SAFIRE's own validator.
  const xml = sp.getMetadata()
    .replace(
      '<EntityDescriptor ',
      '<EntityDescriptor xmlns:remd="http://refeds.org/metadata" xmlns:mdui="urn:oasis:names:tc:SAML:metadata:ui" '
    )
    .replace(/<SPSSODescriptor[^>]*>/, match => match + uiInfoXml())
    .replace('</SPSSODescriptor>', `${attributeConsumingServiceXml()}</SPSSODescriptor>`);

  // SAFIRE's SP requirements mandate Organization + technical/support
  // contacts, and a security contact per the REFEDS Sirtfi baseline —
  // samlify's metadata builder doesn't emit any of these, so they're
  // appended here from env vars. Metadata is published, so these default to
  // the site's role address — never a personal inbox (SAFIRE flagged this).
  const contactName = clean(process.env.SAFIRE_TECH_CONTACT_NAME);
  const techEmail = clean(process.env.SAFIRE_TECH_CONTACT_EMAIL) || 'admin@studentperks.co.za';
  const supportEmail = clean(process.env.SAFIRE_SUPPORT_CONTACT_EMAIL) || techEmail;
  const securityEmail = clean(process.env.SAFIRE_SECURITY_CONTACT_EMAIL) || techEmail;

  const extra = organizationXml() +
    contactPersonXml('technical', contactName, techEmail) +
    contactPersonXml('support', contactName, supportEmail) +
    securityContactXml(contactName, securityEmail);

  return xml.replace('</EntityDescriptor>', `${extra}</EntityDescriptor>`);
}

module.exports = {
  createLoginRedirectUrl,
  parseAcsRequest,
  SSO_INSTITUTIONS: Object.keys(INSTITUTION_IDP_MAP),
  getMetadataXml,
  hasSpCredentials,
  extractStudentProfile,
  institutionFromScope,
  SITE_ORIGIN
};
