const { json, requireServiceKey, rest, verifyVendorToken } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const token = req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '';
  const vendorId = verifyVendorToken(token);
  if (!vendorId) return json(res, 401, { error: 'Vendor session expired. Please sign in again.' });

  try {
    const rows = await rest(`coupon_codes?vendor_id=eq.${encodeURIComponent(vendorId)}&order=created_at.desc&select=*`);
    return json(res, 200, { codes: rows || [] });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not load codes.' });
  }
};
