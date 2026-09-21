const { createLoginRedirectUrl, SITE_ORIGIN } = require('../_saml');

module.exports = async function handler(req, res) {
  try {
    const url = await createLoginRedirectUrl();
    res.statusCode = 302;
    res.setHeader('Location', url);
    res.end();
  } catch (error) {
    res.statusCode = 302;
    res.setHeader('Location', `${SITE_ORIGIN}/?safire=error&reason=${encodeURIComponent(error.message || 'unavailable')}`);
    res.end();
  }
};
