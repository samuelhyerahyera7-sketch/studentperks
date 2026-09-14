const { isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, verifyVendorToken } = require('./_supabase');

function randomSuffix() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return chars[Math.floor(Math.random() * chars.length)] + chars[Math.floor(Math.random() * chars.length)];
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
    const quantity = Math.max(1, Math.min(100, parseInt(body.quantity, 10) || 10));
    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name,code_prefix`);
    const vendor = vendorRows && vendorRows[0];
    if (!isApprovedLiveBusiness(vendor)) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });

    const existing = await rest(`coupon_codes?vendor_id=eq.${encodeURIComponent(vendorId)}&select=code&order=created_at.desc&limit=1`);
    const prefix = String(vendor.code_prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    let startSeq = 1;
    if (existing && existing.length) {
      const seqs = existing.map(row => {
        const match = String(row.code || '').match(new RegExp(`^${prefix}(\\d+)-`));
        return match ? parseInt(match[1], 10) : 0;
      });
      startSeq = Math.max(...seqs, 0) + 1;
    }

    const codes = [];
    for (let i = 0; i < quantity; i += 1) {
      const seq = String(startSeq + i).padStart(3, '0');
      codes.push({
        vendor_id: vendorId,
        vendor_name: vendor.name,
        code: `${prefix}${seq}-${randomSuffix()}`
      });
    }

    await rest('coupon_codes', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(codes)
    });

    return json(res, 200, { generated: codes.length });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not generate codes.' });
  }
};
