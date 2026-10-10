const crypto = require('crypto');
const { escapeHtml, isEmail, sendEmailBatch } = require('./_supabase');
const { sameString, verifySecret } = require('./_security');

const SECRET = process.env.VENDOR_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESET_MINUTES = 30;

// Does this password match the partner's stored one (hashed, or a plain PIN
// saved before hashing)?
function partnerPasswordOk(vendor, password) {
  if (!vendor || !password) return false;
  if (vendor.vendor_pin_hash) return verifySecret(password, vendor.vendor_pin_hash);
  return !!vendor.vendor_pin && sameString(password, vendor.vendor_pin);
}

// Changes whenever the password changes, so a reset link works only once.
function passwordFingerprint(vendor) {
  return crypto.createHash('sha256').update(`${vendor.vendor_pin_hash || ''}|${vendor.vendor_pin || ''}`).digest('base64url').slice(0, 16);
}

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function makeResetToken(vendor) {
  const payload = Buffer.from(JSON.stringify({ v: vendor.id, f: passwordFingerprint(vendor), exp: Date.now() + RESET_MINUTES * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

// -> { vendorId, fingerprint } or null
function readResetToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig || !SECRET || !sameString(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() && data.v ? { vendorId: String(data.v), fingerprint: String(data.f || '') } : null;
  } catch (error) {
    return null;
  }
}

async function sendPartnerEmail(to, subject, bodyHtml) {
  if (!isEmail(to)) return 0;
  return sendEmailBatch([{
    from: process.env.REDEMPTION_EMAIL_FROM || 'StudentPerks <notifications@studentperks.co.za>',
    to: [to],
    subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0b0f19;line-height:1.55">${bodyHtml}
<p style="color:#8a93a3;font-size:12px;margin-top:28px">StudentPerks partner portal · studentperks.co.za/verify</p></div>`
  }]).catch(() => 0);
}

function loginChangedEmail(vendor, { username, password }) {
  const what = [username && `your username is now <strong>${escapeHtml(vendor.code_prefix)}</strong>`, password && 'your password was changed'].filter(Boolean).join(' and ');
  return sendPartnerEmail(vendor.email, 'Your StudentPerks partner login was changed',
    `<p>Hi ${escapeHtml(vendor.name)},</p><p>This is to let you know that ${what}.</p>
<p>If this was you, there's nothing else to do. If it wasn't, please reply to this email or contact StudentPerks straight away.</p>`);
}

module.exports = { RESET_MINUTES, loginChangedEmail, makeResetToken, partnerPasswordOk, passwordFingerprint, readResetToken, sendPartnerEmail };
