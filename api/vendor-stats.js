const { isApprovedLiveBusiness, json, requireServiceKey, rest, verifyVendorToken } = require('./_supabase');

const ALLOWED_DAYS = new Set([1, 7, 30, 90, 365]);
const DAY_MS = 24 * 60 * 60 * 1000;

function bucketKey(date, granularity) {
  if (granularity === 'day') return date.toISOString().slice(0, 10);
  if (granularity === 'month') return date.toISOString().slice(0, 7);
  // week: Monday-start ISO week key
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const token = req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '';
  const vendorId = verifyVendorToken(token);
  if (!vendorId) return json(res, 401, { error: 'Vendor session expired. Please sign in again.' });

  let days = parseInt(req.query && req.query.days, 10);
  if (!ALLOWED_DAYS.has(days)) days = 30;

  try {
    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name,email,discount_desc,code_prefix,logo_url,created_at`);
    const vendor = vendorRows && vendorRows[0];
    if (!isApprovedLiveBusiness(vendor)) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });

    const codes = await rest(`coupon_codes?vendor_id=eq.${encodeURIComponent(vendorId)}&select=is_used,assigned_to_email`);
    let available = 0, assigned = 0, used = 0;
    (codes || []).forEach(c => {
      if (c.is_used) used++;
      else if (c.assigned_to_email) assigned++;
      else available++;
    });
    const total = (codes || []).length;

    const now = Date.now();
    const windowStart = new Date(now - days * DAY_MS).toISOString();
    const prevWindowStart = new Date(now - 2 * days * DAY_MS).toISOString();

    const redemptions = await rest(
      `redemptions?vendor_id=eq.${encodeURIComponent(vendorId)}&redeemed_at=gte.${encodeURIComponent(prevWindowStart)}&order=redeemed_at.asc&select=code,student_email,redeemed_at`
    );

    const current = [];
    const previous = [];
    (redemptions || []).forEach(r => {
      if (r.redeemed_at >= windowStart) current.push(r);
      else previous.push(r);
    });

    const deltaPct = previous.length > 0
      ? Math.round(((current.length - previous.length) / previous.length) * 100)
      : (current.length > 0 ? null : 0); // null = "new activity, no prior baseline"

    const granularity = days <= 31 ? 'day' : (days <= 180 ? 'week' : 'month');
    const buckets = new Map();
    current.forEach(r => {
      const k = bucketKey(new Date(r.redeemed_at), granularity);
      buckets.set(k, (buckets.get(k) || 0) + 1);
    });
    const trend = Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bucket, count]) => ({ bucket, count }));

    const recent = current.slice(-25).reverse();

    return json(res, 200, {
      vendor,
      days,
      inventory: { total, available, assigned, used },
      redeemedInRange: current.length,
      redeemedPrevRange: previous.length,
      deltaPct,
      trend,
      granularity,
      recentRedemptions: recent
    });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not load stats.' });
  }
};
