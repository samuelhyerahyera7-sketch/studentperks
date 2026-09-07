const { clean, json, readBody, requireServiceKey, rest, sendRedemptionEmails } = require('./_supabase');

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

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

    if (action === 'lookup') return json(res, 200, { coupon });
    if (action !== 'redeem') return json(res, 400, { error: 'Unknown action.' });
    if (coupon.is_used) return json(res, 409, { error: 'This code has already been redeemed.' });

    const studentEmail = clean(body.studentEmail) || coupon.assigned_to_email || '';
    const vendor = coupon.vendors || {};
    const now = new Date().toISOString();
    await rest(`coupon_codes?id=eq.${encodeURIComponent(coupon.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_used: true, used_at: now })
    });
    await rest('redemptions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        code: coupon.code,
        vendor_id: coupon.vendor_id,
        vendor_name: coupon.vendor_name || vendor.name || '',
        student_email: studentEmail
      })
    });

    await sendRedemptionEmails({
      code: coupon.code,
      vendorName: coupon.vendor_name || vendor.name || '',
      vendorEmail: vendor.email || '',
      studentEmail,
      studentName: coupon.assigned_to_name || '',
      discount: vendor.discount_desc || '',
      redeemedAt: formatDate(now)
    });

    return json(res, 200, { redeemedAt: now });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not process code.' });
  }
};
