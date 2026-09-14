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
    const body = await readBody(req);
    const codeId = clean(body.codeId);
    const studentName = clean(body.studentName);
    const studentEmail = clean(body.studentEmail).toLowerCase();
    if (!codeId) return json(res, 400, { error: 'Please choose a code.' });
    if (!studentName) return json(res, 400, { error: 'Student name is required.' });
    if (!isEmail(studentEmail)) return json(res, 400, { error: 'Enter a valid student email.' });

    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name`);
    if (!isApprovedLiveBusiness(vendorRows && vendorRows[0])) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });

    const codeRows = await rest(`coupon_codes?id=eq.${encodeURIComponent(codeId)}&vendor_id=eq.${encodeURIComponent(vendorId)}&select=id,is_used`);
    const coupon = codeRows && codeRows[0];
    if (!coupon) return json(res, 404, { error: 'Code not found.' });
    if (coupon.is_used) return json(res, 409, { error: 'This code has already been redeemed.' });

    await rest(`coupon_codes?id=eq.${encodeURIComponent(codeId)}&vendor_id=eq.${encodeURIComponent(vendorId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ assigned_to_name: studentName, assigned_to_email: studentEmail })
    });

    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not assign code.' });
  }
};
