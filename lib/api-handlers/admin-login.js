const { bearer, clean, json, readBody, requireServiceKey, rest, signAdmin, verifyAdminToken } = require('../../api/_supabase');
const { TOO_MANY, clientIp, hashSecret, isLegacyHash, recordAttempt, tooManyAttempts, verifySecret } = require('../../api/_security');

// The admin password hash lives in app_settings (key admin_password_hash),
// or the ADMIN_PASSWORD_HASH environment variable. Older SHA-256 hashes are
// upgraded to salted scrypt the first time they're used.
const SETTING = 'admin_password_hash';

async function currentHash() {
  const rows = await rest(`app_settings?key=eq.${SETTING}&select=value&limit=1`).catch(() => null);
  if (rows && rows[0] && rows[0].value) return rows[0].value;
  return process.env.ADMIN_PASSWORD_HASH || '';
}

function saveHash(value) {
  return rest('app_settings?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: SETTING, value, updated_at: new Date().toISOString() })
  });
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
  const ipKey = `admin-ip:${clientIp(req)}`;
  const limits = [[ipKey, 10], ['admin', 30]];

  if (body.action === 'change') {
    if (!verifyAdminToken(bearer(req))) return json(res, 401, { error: 'Please sign in again.' });
    if (await tooManyAttempts(limits)) return json(res, 429, { error: TOO_MANY });
    if (!verifySecret(body.current || '', await currentHash())) {
      await recordAttempt([ipKey, 'admin']);
      return json(res, 400, { error: 'Current password is incorrect.' });
    }
    const next = String(body.next || '');
    if (next.length < 10) return json(res, 400, { error: 'New password must be at least 10 characters.' });
    try {
      await saveHash(hashSecret(next));
    } catch (error) {
      return json(res, 503, { error: 'Password changes need the database update (secure-database.sql) to be run first.' });
    }
    return json(res, 200, { changed: true });
  }

  if (await tooManyAttempts(limits)) return json(res, 429, { error: TOO_MANY });
  const stored = await currentHash();
  if (!stored) return json(res, 503, { error: 'Admin sign-in is not set up yet.' });
  if (!clean(body.password) || !verifySecret(body.password, stored)) {
    await recordAttempt([ipKey, 'admin']);
    return json(res, 401, { error: 'Incorrect password.' });
  }
  if (isLegacyHash(stored)) await saveHash(hashSecret(body.password)).catch(() => {});
  return json(res, 200, { token: signAdmin() });
};
