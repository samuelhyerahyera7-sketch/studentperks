const crypto = require('crypto');
const { rest } = require('./_supabase');

// ── Password / PIN storage ──
// New hashes are salted scrypt ("scrypt$<salt>$<hash>"). Plain SHA-256 hex
// (the old admin format) is still accepted so it can be upgraded on login.
function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(secret), salt, 32).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

function sameString(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verifySecret(secret, stored) {
  const value = String(stored || '');
  if (!secret || !value) return false;
  if (value.startsWith('scrypt$')) {
    const [, salt, hash] = value.split('$');
    if (!salt || !hash) return false;
    return sameString(crypto.scryptSync(String(secret), salt, 32).toString('base64url'), hash);
  }
  if (/^[0-9a-f]{64}$/i.test(value)) return sameString(crypto.createHash('sha256').update(String(secret), 'utf8').digest('hex'), value.toLowerCase());
  return false;
}

const isLegacyHash = stored => !String(stored || '').startsWith('scrypt$');

// ── Attempt limits ──
// Failed attempts are kept in login_attempts (add-login-security.sql), so the
// limit holds across every server instance.
const WINDOW_MINUTES = 15;

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwarded || String(req.headers['x-real-ip'] || '') || 'unknown').slice(0, 64);
}

// limits: [[key, maxFailures], ...] -> true when any key is over its limit
async function tooManyAttempts(limits) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const keys = limits.map(([key]) => `"${String(key).replace(/["\\]/g, '')}"`).join(',');
  const rows = await rest(`login_attempts?key=in.(${keys})&created_at=gte.${since}&select=key&limit=1000`);
  const counts = {};
  (rows || []).forEach(row => { counts[row.key] = (counts[row.key] || 0) + 1; });
  return limits.some(([key, max]) => (counts[String(key).replace(/["\\]/g, '')] || 0) >= max);
}

async function recordAttempt(keys) {
  await rest('login_attempts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(keys.map(key => ({ key: String(key).replace(/["\\]/g, '') })))
  }).catch(() => {});
}

const TOO_MANY = `Too many attempts. Please wait ${WINDOW_MINUTES} minutes and try again.`;

module.exports = { TOO_MANY, clientIp, hashSecret, isLegacyHash, recordAttempt, sameString, tooManyAttempts, verifySecret };
