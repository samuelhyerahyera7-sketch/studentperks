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
  // req.query.path isn't reliably populated for a bare (non-Next.js) Vercel
  // project's [...path] filename convention, so parse the route key
  // straight from the raw request path instead.
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const key = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  const route = routes[key];
  if (!route) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not found' }));
  }
  return route(req, res);
};
