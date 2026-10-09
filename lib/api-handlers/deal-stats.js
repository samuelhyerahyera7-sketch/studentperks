const { json, requireServiceKey, rest } = require('../../api/_supabase');
const { dealName, DEALS } = require('./track');

const TZ_OFFSET_MS = 2 * 3600 * 1000; // South Africa (SAST, UTC+2, no daylight saving)
const DAY = 86400000;
const CONFIG_CODE = '__TILE_CONFIG__';

function startOfTodaySast(now) {
  return Math.floor((now + TZ_OFFSET_MS) / DAY) * DAY - TZ_OFFSET_MS;
}

async function safeRest(path) {
  try { return (await rest(path)) || []; } catch (error) { return null; }
}

// Totals for the admin "Deal performance" view: views, opens, code reveals
// and redemptions per deal for today / 7 / 30 days / all time, plus today's
// redemptions. Totals only: no student emails are returned.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const now = Date.now();
  const today = startOfTodaySast(now);
  const windows = { today, d7: today - 6 * DAY, d30: today - 29 * DAY, all: 0 };
  const blank = () => ({ today: 0, d7: 0, d30: 0, all: 0 });
  const stats = new Map(DEALS.map(name => [name, { deal: name, view: blank(), open: blank(), code: blank(), redeemed: blank() }]));
  const row = name => {
    if (!stats.has(name)) stats.set(name, { deal: name, view: blank(), open: blank(), code: blank(), redeemed: blank() });
    return stats.get(name);
  };
  const add = (bucket, at) => {
    for (const [key, from] of Object.entries(windows)) if (at >= from) bucket[key] += 1;
  };

  const events = await safeRest('deal_events?select=deal,event,created_at&order=created_at.desc&limit=100000');
  (events || []).forEach(e => {
    const r = row(dealName(e.deal) || e.deal);
    if (r[e.event]) add(r[e.event], Date.parse(e.created_at));
  });

  const redemptions = (await safeRest(`redemptions?code=neq.${CONFIG_CODE}&select=code,vendor_name,redeemed_at,vendors(name)&order=redeemed_at.desc&limit=100000`)) || [];
  const used = (await safeRest('coupon_codes?is_used=eq.true&select=code,used_at,created_at,vendors(name)&limit=100000')) || [];
  const seen = new Set();
  const todayList = [];
  const record = (code, vendor, at) => {
    const name = dealName(vendor) || vendor || 'Unknown';
    add(row(name).redeemed, at);
    if (at >= today) todayList.push({ deal: name, code, at: new Date(at).toISOString() });
  };
  redemptions.forEach(r => {
    seen.add(r.code);
    record(r.code, (r.vendors && r.vendors.name) || r.vendor_name, Date.parse(r.redeemed_at));
  });
  used.forEach(c => {
    if (seen.has(c.code)) return;
    record(c.code, c.vendors && c.vendors.name, Date.parse(c.used_at || c.created_at));
  });

  res.setHeader('Cache-Control', 'no-store');
  return json(res, 200, {
    trackingReady: events !== null,
    generatedAt: new Date(now).toISOString(),
    deals: [...stats.values()],
    redeemedToday: todayList.sort((a, b) => b.at.localeCompare(a.at))
  });
};
