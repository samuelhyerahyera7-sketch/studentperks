const { clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, verifyVendorToken } = require('./_supabase');

function isApprovedDisplayName(name, currentName) {
  const next = clean(name).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '').trim();
  const current = clean(currentName).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '').trim();
  return next === current;
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
    const title = clean(body.title).slice(0, 80);
    const offer = clean(body.offer).slice(0, 120);
    if (!title) return json(res, 400, { error: 'Tile title is required.' });
    if (!offer) return json(res, 400, { error: 'Offer text is required.' });

    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name,email,code_prefix,discount_desc,active`);
    const vendor = vendorRows && vendorRows[0];
    if (!isApprovedLiveBusiness(vendor)) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });
    if (!isApprovedDisplayName(title, vendor.name)) return json(res, 400, { error: 'The public title must keep the approved business name.' });

    const updatedRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&select=id,name,email,code_prefix,discount_desc,active`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: title, discount_desc: offer })
    });
    return json(res, 200, { vendor: updatedRows && updatedRows[0] });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not update website tile.' });
  }
};
