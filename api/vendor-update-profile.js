const { clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, verifyVendorToken } = require('./_supabase');

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
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
    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name`);
    if (!isApprovedLiveBusiness(vendorRows && vendorRows[0])) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });

    const body = await readBody(req);
    const email = clean(body.email);
    const discountDesc = clean(body.discount_desc).slice(0, 500);
    if (!email || !isEmail(email)) return json(res, 400, { error: 'Please enter a valid contact email.' });
    if (!discountDesc) return json(res, 400, { error: 'Please describe your student discount.' });

    // Only these two fields are vendor-editable — name/prefix/PIN/active stay admin-controlled.
    const updated = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ email, discount_desc: discountDesc })
    });

    return json(res, 200, { vendor: updated && updated[0] });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not save your changes.' });
  }
};
