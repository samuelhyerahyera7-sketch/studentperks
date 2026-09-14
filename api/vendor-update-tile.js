const { clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, verifyVendorToken } = require('./_supabase');

const CONFIG_CODE = '__TILE_CONFIG__';

function cleanUrl(value) {
  const url = clean(value).slice(0, 800000);
  if (!url) return '';
  if (/^(https:\/\/|assets\/)/i.test(url)) return url;
  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(url) && url.length <= 750000) return url;
  return '';
}

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
    const tileConfig = {
      backgroundUrl: cleanUrl(body.backgroundUrl),
      logoUrl: cleanUrl(body.logoUrl),
      logoPlacement: 'top-left'
    };
    if (!title) return json(res, 400, { error: 'Tile title is required.' });
    if (!offer) return json(res, 400, { error: 'Offer text is required.' });

    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name,email,code_prefix,discount_desc,active`);
    const vendor = vendorRows && vendorRows[0];
    if (!isApprovedLiveBusiness(vendor)) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });
    if (!isApprovedDisplayName(title, vendor.name)) return json(res, 400, { error: 'The public title must keep the approved business name.' });

    const existingPromise = rest(`redemptions?vendor_id=eq.${encodeURIComponent(vendorId)}&code=eq.${encodeURIComponent(CONFIG_CODE)}&select=id&limit=1`);
    const updatedRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&select=id,name,email,code_prefix,discount_desc,active`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: title, discount_desc: offer })
    });
    const existing = await existingPromise;
    const payload = {
      code: CONFIG_CODE,
      vendor_id: vendorId,
      vendor_name: vendor.name || '',
      student_email: JSON.stringify(tileConfig)
    };
    if (existing && existing[0]) {
      await rest(`redemptions?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(payload)
      });
    } else {
      await rest('redemptions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(payload)
      });
    }
    return json(res, 200, { vendor: updatedRows && updatedRows[0], tileConfig });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not update website tile.' });
  }
};
