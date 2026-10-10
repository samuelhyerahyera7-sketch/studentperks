const { bearer, clean, json, readBody, requireServiceKey, rest, storageSign, verifyAdminToken } = require('../../api/_supabase');
const { BUCKET, PHOTO_SLOTS, age, missing } = require('../../api/_talent');

// Admin view of every work profile (all fields, whatever the student chose
// to share with partners) and photo approval.
//   GET                                          -> { profiles }
//   POST { action:'photo', email, slot, status } -> { profile }
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;
  if (!verifyAdminToken(bearer(req))) return json(res, 401, { error: 'Admin session expired. Please sign in again.' });

  async function present(rows) {
    const paths = rows.flatMap(r => (Array.isArray(r.photos) ? r.photos : []).map(p => p.path));
    const signed = await storageSign(BUCKET, paths);
    return rows.map(r => ({
      ...r,
      age: age(r.date_of_birth),
      missing: missing(r),
      photos: (Array.isArray(r.photos) ? r.photos : []).map(p => ({ ...p, url: signed[p.path] || '' }))
    }));
  }

  try {
    if (req.method === 'GET') {
      const rows = await rest('student_profiles?select=*&order=updated_at.desc&limit=5000');
      return json(res, 200, { profiles: await present(rows || []) });
    }
    const body = await readBody(req);
    if (body.action !== 'photo') return json(res, 400, { error: 'Unsupported request.' });
    const email = clean(body.email).toLowerCase();
    const slot = clean(body.slot);
    const status = clean(body.status);
    if (!PHOTO_SLOTS.includes(slot) || !['approved', 'rejected', 'pending'].includes(status)) return json(res, 400, { error: 'Unsupported request.' });
    const rows = await rest(`student_profiles?student_email=eq.${encodeURIComponent(email)}&select=id,photos&limit=1`);
    const profile = rows && rows[0];
    if (!profile) return json(res, 404, { error: 'Profile not found.' });
    const photos = (profile.photos || []).map(p => (p.slot === slot ? { ...p, status } : p));
    const saved = await rest(`student_profiles?id=eq.${profile.id}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ photos })
    });
    return json(res, 200, { profile: (await present(saved || []))[0] });
  } catch (error) {
    if (/student_profiles/.test(String(error.message))) return json(res, 503, { error: 'Run add-talent-profiles.sql in Supabase to switch on work profiles.' });
    return json(res, 500, { error: 'Could not load work profiles.' });
  }
};
