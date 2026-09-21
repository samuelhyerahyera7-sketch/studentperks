const { clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, signVendor, verifyVendorToken } = require('../../api/_supabase');

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
    const codePrefix = clean(body.codePrefix).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const pin = clean(body.pin);
    if (!codePrefix || codePrefix.length < 3) return json(res, 400, { error: 'Sign-in code must be at least 3 characters.' });
    if (!pin || pin.length < 4) return json(res, 400, { error: 'PIN must be at least 4 characters.' });

    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name,email,code_prefix,discount_desc,active`);
    const vendor = vendorRows && vendorRows[0];
    if (!isApprovedLiveBusiness(vendor)) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });

    const duplicates = await rest(`vendors?code_prefix=eq.${encodeURIComponent(codePrefix)}&id=neq.${encodeURIComponent(vendorId)}&select=id`);
    if (duplicates && duplicates.length) return json(res, 409, { error: 'That sign-in code is already taken.' });

    const updatedRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&select=id,name,email,code_prefix,discount_desc,active`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ code_prefix: codePrefix, vendor_pin: pin })
    });
    const updated = updatedRows && updatedRows[0];
    return json(res, 200, { vendor: updated, token: signVendor(vendorId) });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not update login details.' });
  }
};
