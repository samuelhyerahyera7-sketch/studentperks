// A single catch-all Serverless Function for every /api/* route.
//
// Vercel's Hobby plan caps a deployment at 12 Serverless Functions; this
// project has 20 route handlers. Each still lives at its own file under
// lib/api-handlers/ (untouched otherwise) so the actual endpoint logic
// stays easy to find, but Vercel only ever builds this one dispatcher —
// none of the URLs below changed, so the front-end needed no updates.
const routes = {
  'check-student-status': require('../lib/api-handlers/check-student-status'),
  'mark-student-email-verified': require('../lib/api-handlers/mark-student-email-verified'),
  'notify-application-approved': require('../lib/api-handlers/notify-application-approved'),
  'notify-new-application': require('../lib/api-handlers/notify-new-application'),
  'notify-redemption': require('../lib/api-handlers/notify-redemption'),
  'public-vendors': require('../lib/api-handlers/public-vendors'),
  'redeem-code': require('../lib/api-handlers/redeem-code'),
  'vendor-check-code': require('../lib/api-handlers/vendor-check-code'),
  'vendor-codes': require('../lib/api-handlers/vendor-codes'),
  'vendor-jobs': require('../lib/api-handlers/vendor-jobs'),
  'public-jobs': require('../lib/api-handlers/public-jobs'),
  'student-set-name': require('../lib/api-handlers/student-set-name'),
  'track': require('../lib/api-handlers/track'),
  'deal-stats': require('../lib/api-handlers/deal-stats'),
  'admin-login': require('../lib/api-handlers/admin-login'),
  'admin-db': require('../lib/api-handlers/admin-db'),
  'deal-code': require('../lib/api-handlers/deal-code'),
  'admin-talent': require('../lib/api-handlers/admin-talent'),
  'talent-profile': require('../lib/api-handlers/talent-profile'),
  'talent-photo': require('../lib/api-handlers/talent-photo'),
  'email-prefs': require('../lib/api-handlers/email-prefs'),
  'vendor-help': require('../lib/api-handlers/vendor-help'),
  'vendor-forgot-password': require('../lib/api-handlers/vendor-forgot-password'),
  'vendor-reset-password': require('../lib/api-handlers/vendor-reset-password'),
  'vendor-generate-codes': require('../lib/api-handlers/vendor-generate-codes'),
  'vendor-login': require('../lib/api-handlers/vendor-login'),
  'vendor-record-redemption': require('../lib/api-handlers/vendor-record-redemption'),
  'vendor-redeem': require('../lib/api-handlers/vendor-redeem'),
  'vendor-redemptions': require('../lib/api-handlers/vendor-redemptions'),
  'vendor-tile-config': require('../lib/api-handlers/vendor-tile-config'),
  'vendor-update-login': require('../lib/api-handlers/vendor-update-login'),
  'vendor-update-tile': require('../lib/api-handlers/vendor-update-tile'),
  'saml/acs': require('../lib/api-handlers/saml/acs'),
  'saml/login': require('../lib/api-handlers/saml/login'),
  'saml/metadata': require('../lib/api-handlers/saml/metadata')
};

module.exports = async function handler(req, res) {
  // vercel.json rewrites every /api/:path* request to /api/dispatch?path=:path*,
  // so the original route lives in the query string here. Falling back to
  // the raw pathname covers a direct hit on /api/dispatch itself.
  const url = new URL(req.url, 'http://localhost');
  const key = url.searchParams.get('path') || url.pathname.replace(/^\/api\/dispatch\/?/, '').replace(/\/+$/, '');
  const route = routes[key];
  if (!route) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not found' }));
  }
  return route(req, res);
};
