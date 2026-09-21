const { isApprovedLiveBusiness, json, requireServiceKey, rest } = require('../../api/_supabase');

const CONFIG_CODE = '__TILE_CONFIG__';

function parseConfig(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
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

  try {
    const vendors = (await rest('vendors?active=eq.true&order=created_at.desc&select=id,name,code_prefix,discount_desc,active,created_at')) || [];
    const approved = vendors.filter(vendor => vendor && vendor.name && isApprovedLiveBusiness(vendor));
    const ids = approved.map(vendor => vendor.id).filter(Boolean);
    let configRows = [];
    if (ids.length) {
      configRows = await rest(`redemptions?code=eq.${encodeURIComponent(CONFIG_CODE)}&vendor_id=in.(${ids.join(',')})&select=vendor_id,student_email`);
    }
    const configs = new Map((configRows || []).map(row => [row.vendor_id, parseConfig(row.student_email)]));
    const deals = approved.map(vendor => ({ ...vendor, tile_config: configs.get(vendor.id) || {} }));
    return json(res, 200, { vendors: deals });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not load public deals.' });
  }
};
