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

const ATTRIBUTE_KEYS = {
  mail: ['mail', 'urn:oid:0.9.2342.19200300.100.1.3', 'email'],
  eppn: ['eduPersonPrincipalName', 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6'],
  displayName: ['displayName', 'urn:oid:2.16.840.1.113730.3.1.241'],
  givenName: ['givenName', 'urn:oid:2.5.4.42'],
  sn: ['sn', 'surname', 'urn:oid:2.5.4.4'],
  scopedAffiliation: ['eduPersonScopedAffiliation', 'urn:oid:1.3.6.1.4.1.5923.1.1.1.9'],
  affiliation: ['eduPersonAffiliation', 'urn:oid:1.3.6.1.4.1.5923.1.1.1.1'],
  schacHomeOrganization: ['schacHomeOrganization', 'urn:oid:1.3.6.1.4.1.25178.1.2.9']
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
  const eppn = firstValue(attrs, ATTRIBUTE_KEYS.eppn);
  const mail = firstValue(attrs, ATTRIBUTE_KEYS.mail) || (eppn.includes('@') ? eppn : '');
  const givenName = firstValue(attrs, ATTRIBUTE_KEYS.givenName);
  const sn = firstValue(attrs, ATTRIBUTE_KEYS.sn);
  const displayName = firstValue(attrs, ATTRIBUTE_KEYS.displayName) || [givenName, sn].filter(Boolean).join(' ');
  const scopedAffiliations = allValues(attrs, ATTRIBUTE_KEYS.scopedAffiliation);
  const affiliations = allValues(attrs, ATTRIBUTE_KEYS.affiliation);
  const allAffiliations = scopedAffiliations.concat(affiliations);
  const isStudent = allAffiliations.some(value => value.split('@')[0].toLowerCase() === 'student');

  let institution = firstValue(attrs, ATTRIBUTE_KEYS.schacHomeOrganization);
  if (!institution) {
    const scoped = scopedAffiliations.find(value => value.includes('@'));
    if (scoped) institution = scoped.split('@')[1];
    else if (eppn.includes('@')) institution = eppn.split('@')[1];
  }

  return {
    email: mail.toLowerCase(),
    fullName: displayName,
    institution,
    isStudent,
    affiliations: allAffiliations,
    studentNumber: eppn
  };
}

async function createLoginRedirectUrl(relayState) {
  const sp = getServiceProvider();
  if (!sp) throw new Error('SAML sign-in is not configured yet.');
  const idp = await getIdentityProvider();
  const { context } = sp.createLoginRequest(idp, 'redirect', relayState ? { relayState } : undefined);
  return context;
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
  // contacts use contactType="other" plus the REFEDS extension marker —
  // see https://refeds.org/category/security-incident-response
  if (!email) return '';
  const nameXml = name ? `<GivenName>${escapeXml(name)}</GivenName>` : '';
  return `<ContactPerson contactType="other" xmlns:remd="http://refeds.org/metadata">` +
    `<Extensions><remd:contactType>http://refeds.org/metadata/contactType/security</remd:contactType></Extensions>` +
    `${nameXml}<EmailAddress>mailto:${escapeXml(email)}</EmailAddress></ContactPerson>`;
}

function getMetadataXml() {
  const sp = getServiceProvider();
  if (!sp) throw new Error('SAML sign-in is not configured yet.');
  const xml = sp.getMetadata();

  // SAFIRE's SP requirements mandate Organization + technical/support
  // contacts, and a security contact per the REFEDS Sirtfi baseline —
  // samlify's metadata builder doesn't emit any of these, so they're
  // appended here from env vars (falling back to the admin notification
  // address already used for application-review emails).
  const contactName = clean(process.env.SAFIRE_TECH_CONTACT_NAME);
  const techEmail = clean(process.env.SAFIRE_TECH_CONTACT_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL);
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
  getMetadataXml,
  hasSpCredentials,
  extractStudentProfile,
  SITE_ORIGIN
};
