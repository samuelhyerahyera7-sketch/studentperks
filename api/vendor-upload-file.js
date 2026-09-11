const { SUPABASE_URL, SERVICE_KEY, clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, verifyVendorToken } = require('./_supabase');

const MAX_BYTES = 4 * 1024 * 1024; // 4MB — stays under Vercel's serverless body-size limit
const ALLOWED_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf'
]);

function safeName(name) {
  return clean(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file';
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
    const contentType = clean(body.contentType);
    const dataBase64 = clean(body.dataBase64);
    const fileName = safeName(body.fileName);
    if (!ALLOWED_TYPES.has(contentType)) return json(res, 400, { error: 'Please upload a CSV, XLSX or PDF file.' });
    if (!dataBase64) return json(res, 400, { error: 'No file received.' });

    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length > MAX_BYTES) return json(res, 400, { error: 'File must be under 4MB.' });

    const storagePath = `${vendorId}/${Date.now()}-${fileName}`;

    const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/vendor-uploads/${storagePath}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'false'
      },
      body: buffer
    });
    if (!uploadResponse.ok) {
      const detail = await uploadResponse.text();
      throw new Error(`Storage upload failed: ${detail}`);
    }

    const inserted = await rest('vendor_uploads', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        vendor_id: vendorId,
        file_name: fileName,
        storage_path: storagePath,
        content_type: contentType,
        file_size: buffer.length
      })
    });

    return json(res, 200, { file: inserted && inserted[0] });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not upload file.' });
  }
};
