const { createLoginRedirectUrl, SITE_ORIGIN } = require('../../../api/_saml');

module.exports = async function handler(req, res) {
  try {
    const institution = new URL(req.url, SITE_ORIGIN).searchParams.get('inst') || '';
    const url = await createLoginRedirectUrl(institution);
    res.statusCode = 302;
    res.setHeader('Location', url);
    res.end();
  } catch (error) {
    res.statusCode = 302;
    res.setHeader('Location', `${SITE_ORIGIN}/?safire=error&reason=${encodeURIComponent(error.message || 'unavailable')}`);
    res.end();
  }
};
