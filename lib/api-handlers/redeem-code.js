const { clean, isApprovedLiveBusiness, json, latestApplication, membershipStatus, readBody, requireServiceKey, rest } = require('../../api/_supabase');
const { redeemCoupon } = require('../../api/_redeem');

async function findCoupon(code) {
  const rows = await rest(`coupon_codes?code=eq.${encodeURIComponent(code)}&select=*,vendors(name,email,discount_desc)`);
  return rows && rows[0];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  try {
    const body = await readBody(req);
    const action = clean(body.action);
    const code = clean(body.code).toUpperCase();
    if (!code) return json(res, 400, { error: 'Code is required.' });

    const coupon = await findCoupon(code);
    if (!coupon) return json(res, 404, { error: 'This code does not exist.' });
    if (!isApprovedLiveBusiness(coupon.vendors)) return json(res, 404, { error: 'This code does not exist.' });

    if (action === 'lookup') return json(res, 200, { coupon });
    if (action !== 'redeem') return json(res, 400, { error: 'Unknown action.' });
    if (coupon.is_used) return json(res, 409, { error: 'This code has already been redeemed.' });
    if (coupon.assigned_to_email) {
      const owner = await latestApplication(coupon.assigned_to_email);
      if (membershipStatus(owner) === 'expired') return json(res, 403, { error: "This student's StudentPerks membership has expired, so the code can't be used until they renew." });
    }

    const studentEmail = clean(body.studentEmail) || coupon.assigned_to_email || '';
    const now = await redeemCoupon(coupon, studentEmail);
    if (!now) return json(res, 409, { error: 'This code has already been redeemed.' });
    return json(res, 200, { redeemedAt: now });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not process code.' });
  }
};
