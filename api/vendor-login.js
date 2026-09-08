const { clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, signVendor } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  try {
    const body = await readBody(req);
    const prefix = clean(body.prefix).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const pin = clean(body.pin);
    if (!prefix || !pin) return json(res, 400, { error: 'Vendor code and PIN are required.' });

    const rows = await rest(`vendors?code_prefix=eq.${encodeURIComponent(prefix)}&vendor_pin=eq.${encodeURIComponent(pin)}&active=eq.true&select=id,name,email,code_prefix,discount_desc,active`);
    const vendor = rows && rows[0];
    if (!vendor) return json(res, 401, { error: 'Incorrect vendor code or PIN.' });
    if (!isApprovedLiveBusiness(vendor)) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });

    return json(res, 200, { vendor, token: signVendor(vendor.id) });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Vendor sign-in failed.' });
  }
};
