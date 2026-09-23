const samlify = require('samlify');
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
    // 1.1 emailAddress format (samlify's default) as excluding both SAML 2
    // NameID formats.
    nameIDFormat: [
      'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'
    ],
    assertionConsumerService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: ACS_URL
    }]
  });
  return spInstance;
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
  const xml = await response.text();
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

// Maps the institution dropdown values in index.html to the entityID each
// institution's IdP is published under behind the SAFIRE hub's BIRK proxy
// (from https://metadata.safire.ac.za/safire-idp-proxy-metadata.xml).
// Passing one of these as `idpentityid` on the hub's SSO endpoint skips its
// own institution-picker page and sends the browser straight to that
// institution's login — the student never sees a federation-branded
// screen, only their own university's login (matching what SAFIRE-joined
// SPs like Varsity Vibe do). Institutions not listed here (not yet SAFIRE
// members, or not in our dropdown) fall back to the hub's own picker.
const INSTITUTION_IDP_MAP = {
  'University of Cape Town (UCT)': 'https://proxy.safire.ac.za/birk.php/srvslsfed001.uct.ac.za/simplesaml/saml2/idp/metadata.php',
  'University of the Witwatersrand (Wits)': 'https://proxy.safire.ac.za/birk.php/idp.wits.ac.za/safss/saml2/idp/metadata.php',
  'Stellenbosch University (SU)': 'http://proxy.safire.ac.za/birk.php/federate.sun.ac.za/adfs/services/trust',
  'University of Pretoria (UP)': 'https://proxy.safire.ac.za/birk.php/www1.up.ac.za:443/oam/fed',
  'University of KwaZulu-Natal (UKZN)': 'http://proxy.safire.ac.za/birk.php/federation.ukzn.ac.za/adfs/services/trust',
  'North-West University (NWU)': 'https://proxy.safire.ac.za/birk.php/shib.nwu.ac.za/idp/shibboleth',
  'University of the Western Cape (UWC)': 'https://proxy.safire.ac.za/birk.php/saml.uwc.ac.za/simplesaml/saml2/idp/metadata.php',
  'Rhodes University': 'https://proxy.safire.ac.za/birk.php/login.ru.ac.za/idp/shibboleth',
  'University of Venda': 'https://proxy.safire.ac.za/birk.php/sts.windows.net/f38ba9d8-554c-48a2-ae42-13b1e7f3c797/',
  'University of Fort Hare': 'http://proxy.safire.ac.za/birk.php/federate.ufh.ac.za/adfs/services/trust',
  'Walter Sisulu University (WSU)': 'https://proxy.safire.ac.za/birk.php/idp.wsu.ac.za/simplesaml/saml2/idp/metadata.php',
  'Sol Plaatje University': 'https://proxy.safire.ac.za/birk.php/sts.windows.net/acbcaed8-7adc-460c-ba57-028bdc80d84a/',
  'Cape Peninsula University of Technology (CPUT)': 'https://proxy.safire.ac.za/birk.php/sts.windows.net/cc6148eb-d356-4f38-900f-3a4d62b954c8/',
  'Durban University of Technology (DUT)': 'https://proxy.safire.ac.za/birk.php/sts.windows.net/4b1930d1-12f4-40b5-b48c-bd86117429d8/',
  'Tshwane University of Technology (TUT)': 'https://proxy.safire.ac.za/birk.php/sts.windows.net/3df74539-9453-4d03-bb9d-b9102cb9ce9c/',
  'Vaal University of Technology (VUT)': 'http://proxy.safire.ac.za/birk.php/logmein.vut.ac.za/adfs/services/trust',
  'Central University of Technology (CUT)': 'http://proxy.safire.ac.za/birk.php/logon.cut.ac.za/adfs/services/trust'
};

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

  // Guy Halse (SAFIRE, 2026-09-23): schacHomeOrganization is a subset of
  // eduPersonScopedAffiliation, so prefer deriving the institution from the
  // affiliation's @scope — schacHomeOrganization is kept only as a fallback
  // for the rare case an IdP releases it without a usable scoped affiliation.
  let institution = '';
  const scoped = scopedAffiliations.find(value => value.includes('@'));
  if (scoped) institution = scoped.split('@')[1];
  if (!institution) institution = firstValue(attrs, ATTRIBUTE_KEYS.schacHomeOrganization);
  if (!institution && eppn.includes('@')) institution = eppn.split('@')[1];

  return {
    email: mail.toLowerCase(),
    fullName: displayName,
    institution,
    isStudent,
    affiliations: allAffiliations,
    // eduPersonTargetedID is the pseudonymous, SP-specific identifier
    // SAFIRE generates for free (see ATTRIBUTE_KEYS comment above) —
    // stored for audit/dedup purposes since eppn won't be present.
    studentNumber: targetedId || eppn
  };
}

async function createLoginRedirectUrl(institution, relayState) {
  const sp = getServiceProvider();
  if (!sp) throw new Error('SAML sign-in is not configured yet.');
  const idp = await getIdentityProvider();
  const { context } = sp.createLoginRequest(idp, 'redirect', relayState ? { relayState } : undefined);
  const idpEntityId = INSTITUTION_IDP_MAP[institution];
  return idpEntityId ? `${context}&idpentityid=${encodeURIComponent(idpEntityId)}` : context;
}

async function parseAcsRequest(req) {
  const sp = getServiceProvider();
  if (!sp) throw new Error('SAML sign-in is not configured yet.');
  const idp = await getIdentityProvider();
  const body = await readFormBody(req);
  const { extract } = await sp.parseLoginResponse(idp, 'post', { body });
  return { profile: extractStudentProfile(extract.attributes), relayState: body.RelayState || '' };
}

function escapeXml(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function organizationXml() {
  const name = escapeXml(process.env.SAFIRE_ORG_NAME || 'StudentPerks');
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

// Guy Halse's revised wording (2026-09-23) — deliberately doesn't name
// SAFIRE: "If we do our job right, students have no idea who we are."
const SERVICE_NAME = 'StudentPerks';
const SERVICE_DESCRIPTION = "Verifies SA student status via their home institution so students can unlock exclusive discounts.";

function uiInfoXml() {
  const privacyUrl = `${SITE_ORIGIN}/privacy.html`;
  const logoUrl = `${SITE_ORIGIN}/favicon.svg`;
  return `<Extensions><mdui:UIInfo xmlns:mdui="urn:oasis:names:tc:SAML:metadata:ui">` +
    `<mdui:DisplayName xml:lang="en">${escapeXml(SERVICE_NAME)}</mdui:DisplayName>` +
    `<mdui:Description xml:lang="en">${escapeXml(SERVICE_DESCRIPTION)}</mdui:Description>` +
    `<mdui:PrivacyStatementURL xml:lang="en">${escapeXml(privacyUrl)}</mdui:PrivacyStatementURL>` +
    `<mdui:Logo height="256" width="256">${escapeXml(logoUrl)}</mdui:Logo>` +
    `</mdui:UIInfo></Extensions>`;
}

// Guy's suggestion: schacHomeOrganization is derivable from
// eduPersonScopedAffiliation, so it's marked optional/not requested with
// the same weight — kept only as a fallback (see extractStudentProfile).
function attributeConsumingServiceXml() {
  const attrs = [
    { name: 'urn:oid:0.9.2342.19200300.100.1.3', friendly: 'mail', required: true },
    { name: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.9', friendly: 'eduPersonScopedAffiliation', required: true },
    { name: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.10', friendly: 'eduPersonTargetedID', required: false },
    { name: 'urn:oid:1.3.6.1.4.1.25178.1.2.9', friendly: 'schacHomeOrganization', required: false }
  ];
  const requested = attrs.map(a =>
    `<RequestedAttribute FriendlyName="${a.friendly}" Name="${a.name}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" isRequired="${a.required}"/>`
  ).join('');
  return `<AttributeConsumingService index="0">` +
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
  let xml = sp.getMetadata().replace(
    '<EntityDescriptor ',
    '<EntityDescriptor xmlns:remd="http://refeds.org/metadata" '
  );

  // mdui:UIInfo must be the first child of SPSSODescriptor (inside its own
  // Extensions element), and AttributeConsumingService must come after
  // AssertionConsumerService — samlify emits neither, and SAFIRE's
  // validator flagged both as missing.
  xml = xml.replace(/(<SPSSODescriptor[^>]*>)/, `$1${uiInfoXml()}`);
  xml = xml.replace('</SPSSODescriptor>', `${attributeConsumingServiceXml()}</SPSSODescriptor>`);

  // SAFIRE's SP requirements mandate Organization + technical/support
  // contacts, and a security contact per the REFEDS Sirtfi baseline —
  // samlify's metadata builder doesn't emit any of these, so they're
  // appended here from env vars (falling back to the admin notification
  // address already used for application-review emails).
  const contactName = clean(process.env.SAFIRE_TECH_CONTACT_NAME);
  const techEmail = clean(process.env.SAFIRE_TECH_CONTACT_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL);
  const supportName = clean(process.env.SAFIRE_SUPPORT_CONTACT_NAME) || 'Support';
  const supportEmail = clean(process.env.SAFIRE_SUPPORT_CONTACT_EMAIL) || techEmail;
  const securityName = clean(process.env.SAFIRE_SECURITY_CONTACT_NAME) || 'Security';
  const securityEmail = clean(process.env.SAFIRE_SECURITY_CONTACT_EMAIL) || techEmail;

  const extra = organizationXml() +
    contactPersonXml('technical', contactName, techEmail) +
    contactPersonXml('support', supportName, supportEmail) +
    securityContactXml(securityName, securityEmail);

  return xml.replace('</EntityDescriptor>', `${extra}</EntityDescriptor>`);
}

module.exports = {
  createLoginRedirectUrl,
  parseAcsRequest,
  SSO_INSTITUTIONS: Object.keys(INSTITUTION_IDP_MAP),
  getMetadataXml,
  hasSpCredentials,
  extractStudentProfile,
  SITE_ORIGIN
};
