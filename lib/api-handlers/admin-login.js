const crypto = require('crypto');
const { bearer, clean, json, readBody, requireServiceKey, rest, signAdmin, verifyAdminToken } = require('../../api/_supabase');

// The admin password used to be checked only in the browser. The original
// hash stays the default so the same password keeps working; a changed
// password is stored in app_settings (created by secure-database.sql).
const DEFAULT_HASH = '5e7b9ea5a153f3ca9a889f6d6145707494b9d260dc2d13a56b152ea5198a578d';
const SETTING = 'admin_password_hash';

const sha256 = text => crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');

async function currentHash() {
  try {
    const rows = await rest(`app_settings?key=eq.${SETTING}&select=value&limit=1`);
    if (rows && rows[0] && rows[0].value) return rows[0].value;
  } catch (error) {
    // app_settings not created yet
  }
  return process.env.ADMIN_PASSWORD_HASH || DEFAULT_HASH;
}

function sameHash(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

//   POST { password }                              -> { token }
//   POST { action:'change', current, next } (admin) -> { changed:true }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;
  const body = await readBody(req).catch(() => ({}));

  if (body.action === 'change') {
    if (!verifyAdminToken(bearer(req))) return json(res, 401, { error: 'Please sign in again.' });
    if (!sameHash(sha256(body.current || ''), await currentHash())) return json(res, 400, { error: 'Current password is incorrect.' });
    const next = String(body.next || '');
    if (next.length < 8) return json(res, 400, { error: 'New password must be at least 8 characters.' });
    try {
      await rest('app_settings?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: SETTING, value: sha256(next) })
      });
    } catch (error) {
      return json(res, 503, { error: 'Password changes need the database update (secure-database.sql) to be run first.' });
    }
    return json(res, 200, { changed: true });
  }

  // Slow every attempt a little so the password can't be guessed quickly.
  await new Promise(resolve => setTimeout(resolve, 400));
  if (!clean(body.password) || !sameHash(sha256(body.password), await currentHash())) {
    return json(res, 401, { error: 'Incorrect password.' });
  }
  return json(res, 200, { token: signAdmin() });
};
