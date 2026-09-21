const { isApprovedLiveBusiness, json, requireServiceKey, rest, verifyVendorToken } = require('../../api/_supabase');

const CONFIG_CODE = '__TILE_CONFIG__';

function parseConfig(row) {
  if (!row || !row.student_email) return {};
  try {
    return JSON.parse(row.student_email);
  } catch {
    return {};
  }
}

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
    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name`);
    if (!isApprovedLiveBusiness(vendorRows && vendorRows[0])) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });
    const rows = await rest(`redemptions?vendor_id=eq.${encodeURIComponent(vendorId)}&code=eq.${encodeURIComponent(CONFIG_CODE)}&select=student_email&limit=1`);
    return json(res, 200, { tileConfig: parseConfig(rows && rows[0]) });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not load website tile settings.' });
  }
};
