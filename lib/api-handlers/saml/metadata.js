const { getMetadataXml, hasSpCredentials } = require('../../../api/_saml');
const { json } = require('../../../api/_supabase');

module.exports = async function handler(req, res) {
  if (!hasSpCredentials()) {
    return json(res, 500, { error: 'SAML sign-in is not configured yet.' });
  }
  try {
    const xml = getMetadataXml();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/samlmetadata+xml');
    res.end(xml);
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not build SAML metadata.' });
  }
};
