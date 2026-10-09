const { clean, json, normalizeBusinessName, readBody, rest } = require('../../api/_supabase');

// Deals that can be tracked: live partners and those listed as coming soon.
const DEALS = ['Just Protein', 'Terbodore Coffee', 'Intercity Xpress', 'Crates & Boxes', 'Custom Mugs', 'Planet Fitness'];
const BY_KEY = new Map(DEALS.map(name => [normalizeBusinessName(name), name]));
const EVENTS = new Set(['view', 'open', 'code']);
const SOURCES = new Set(['home', 'dashboard']);

function dealName(value) {
  const key = normalizeBusinessName(value);
  if (BY_KEY.has(key)) return BY_KEY.get(key);
  for (const [k, name] of BY_KEY) if (key.includes(k) || k.includes(key) && key.length > 4) return name;
  return '';
}

// Records that a deal card was seen ('view'), tapped ('open') or its code
// shown ('code'). Called by the homepage and student dashboard with
// navigator.sendBeacon, so it always answers 204 and never blocks the page.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  try {
    const body = await readBody(req);
    const deal = dealName(body.deal);
    const event = clean(body.event);
    const source = SOURCES.has(clean(body.source)) ? clean(body.source) : '';
    if (deal && EVENTS.has(event) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await rest('deal_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ deal, event, source })
      });
    }
  } catch (error) {
    // Tracking is best-effort (e.g. before add-deal-events.sql has been run).
  }
  res.statusCode = 204;
  return res.end();
};

module.exports.dealName = dealName;
module.exports.DEALS = DEALS;
