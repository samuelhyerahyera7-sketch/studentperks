const { clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, verifyVendorToken } = require('./_supabase');

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
    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name`);
    if (!isApprovedLiveBusiness(vendorRows && vendorRows[0])) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });
    const body = await readBody(req);
    const code = clean(body.code).toUpperCase();
    if (!code) return json(res, 400, { error: 'Code is required.' });
    const rows = await rest(`coupon_codes?code=eq.${encodeURIComponent(code)}&select=*`);
    const coupon = rows && rows[0];
    if (!coupon) return json(res, 404, { error: 'This code does not exist.' });
    if (coupon.vendor_id !== vendorId) return json(res, 403, { error: 'This code belongs to a different vendor.' });
    return json(res, 200, { coupon });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not check code.' });
  }
};
