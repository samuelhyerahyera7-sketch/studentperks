const { SUPABASE_URL, SERVICE_KEY, clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, verifyVendorToken } = require('./_supabase');

const MAX_BYTES = 4 * 1024 * 1024; // 4MB — stays under Vercel's serverless body-size limit
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

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
    const contentType = clean(body.contentType);
    const dataBase64 = clean(body.dataBase64);
    if (!ALLOWED_TYPES.has(contentType)) return json(res, 400, { error: 'Please upload a PNG, JPG, WEBP or SVG image.' });
    if (!dataBase64) return json(res, 400, { error: 'No file received.' });

    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length > MAX_BYTES) return json(res, 400, { error: 'Logo must be under 4MB.' });

    const ext = EXT_BY_TYPE[contentType];
    const path = `${vendorId}/logo.${ext}`;

    const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/vendor-logos/${path}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: buffer
    });
    if (!uploadResponse.ok) {
      const detail = await uploadResponse.text();
      throw new Error(`Storage upload failed: ${detail}`);
    }

    const logoUrl = `${SUPABASE_URL}/storage/v1/object/public/vendor-logos/${path}?v=${Date.now()}`;
    await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ logo_url: logoUrl })
    });

    return json(res, 200, { logo_url: logoUrl });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not upload logo.' });
  }
};
