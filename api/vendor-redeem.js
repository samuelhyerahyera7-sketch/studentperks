const { clean, json, readBody, requireServiceKey, rest, sendRedemptionEmails, verifyVendorToken } = require('./_supabase');

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const token = req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '';
  const vendorId = verifyVendorToken(token);
  if (!vendorId) return json(res, 401, { error: 'Vendor session expired. Please sign in again.' });

  try {
    const body = await readBody(req);
    const code = clean(body.code).toUpperCase();
    const now = new Date().toISOString();
    const rows = await rest(`coupon_codes?code=eq.${encodeURIComponent(code)}&select=*,vendors(name,email,discount_desc)`);
    const coupon = rows && rows[0];
    if (!coupon) return json(res, 404, { error: 'This code does not exist.' });
    if (coupon.vendor_id !== vendorId) return json(res, 403, { error: 'This code belongs to a different vendor.' });
    if (coupon.is_used) return json(res, 409, { error: 'This code has already been redeemed.' });

    const vendor = coupon.vendors || {};
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
        student_email: coupon.assigned_to_email || ''
      })
    });

    await sendRedemptionEmails({
      code: coupon.code,
      vendorName: coupon.vendor_name || vendor.name || '',
      vendorEmail: vendor.email || '',
      studentEmail: coupon.assigned_to_email || '',
      studentName: coupon.assigned_to_name || '',
      discount: vendor.discount_desc || '',
      redeemedAt: formatDate(now)
    });

    return json(res, 200, { redeemedAt: now });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not redeem code.' });
  }
};
