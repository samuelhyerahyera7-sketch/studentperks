const { bearer, json, readBody, requireServiceKey, signStudentCardUrls, verifyAdminToken } = require('../../api/_supabase');

// Database access for admin.html, which signs in through /api/admin-login.
// The browser sends a small description of the query; it runs here with the
// service key so the tables can be closed to the public.
const TABLES = new Set(['student_applications', 'vendor_applications', 'vendors', 'coupon_codes', 'redemptions']);
const OPS = new Set(['select', 'insert', 'update', 'delete']);
const FILTERS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is', 'not.is']);
const COLUMN = /^[a-z_][a-z0-9_]*$/;
const SELECT = /^[a-z0-9_*,() ]+$/i;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bulmerqkvvrjvzjwmgkl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function buildQuery(spec) {
  const params = new URLSearchParams();
  if (spec.op === 'select' || spec.op === 'insert' || spec.op === 'update') params.set('select', spec.select && SELECT.test(spec.select) ? spec.select.replace(/\s+/g, '') : '*');
  for (const filter of spec.filters || []) {
    const [column, op, value] = filter;
    if (!COLUMN.test(column) || !FILTERS.has(op)) throw new Error('Unsupported filter.');
    params.append(column, `${op}.${value === null ? 'null' : value}`);
  }
  if (spec.order && COLUMN.test(spec.order[0])) params.set('order', `${spec.order[0]}.${spec.order[1] === false ? 'desc' : 'asc'}`);
  if (Number.isInteger(spec.limit) && spec.limit > 0) params.set('limit', String(Math.min(spec.limit, 5000)));
  return params.toString();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;
  if (!verifyAdminToken(bearer(req))) return json(res, 401, { error: 'Admin session expired. Please sign in again.' });

  try {
    const spec = await readBody(req);
    if (!TABLES.has(spec.table) || !OPS.has(spec.op)) return json(res, 400, { error: 'Unsupported request.' });
    if ((spec.op === 'update' || spec.op === 'delete') && !(spec.filters || []).length) return json(res, 400, { error: 'Refusing to change every row.' });

    const method = { select: spec.head ? 'HEAD' : 'GET', insert: 'POST', update: 'PATCH', delete: 'DELETE' }[spec.op];
    const prefer = [];
    if (spec.op !== 'select') prefer.push(spec.op === 'delete' ? 'return=minimal' : 'return=representation');
    if (spec.count) prefer.push('count=exact');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${spec.table}?${buildQuery(spec)}`, {
      method,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        ...(prefer.length ? { Prefer: prefer.join(',') } : {})
      },
      body: spec.op === 'insert' || spec.op === 'update' ? JSON.stringify(spec.values || {}) : undefined
    });
    const text = method === 'HEAD' ? '' : await response.text();
    const range = response.headers.get('content-range') || '';
    const count = spec.count && range.includes('/') ? Number(range.split('/')[1]) : null;
    let data = text ? JSON.parse(text) : (spec.head ? null : []);
    if (!response.ok) {
      return json(res, 200, { data: null, count, error: { message: (data && (data.message || data.error)) || `HTTP ${response.status}`, code: data && data.code } });
    }
    if (spec.table === 'student_applications' && Array.isArray(data) && data.some(r => r && r.card_photo_url)) {
      const signed = await signStudentCardUrls(data.map(r => r && r.card_photo_url));
      data = data.map(r => (r && r.card_photo_url ? { ...r, card_photo_url: signed[r.card_photo_url] || r.card_photo_url } : r));
    }
    return json(res, 200, { data, count, error: null });
  } catch (error) {
    return json(res, 200, { data: null, count: null, error: { message: error.message || 'Request failed.' } });
  }
};

module.exports.buildQuery = buildQuery;
