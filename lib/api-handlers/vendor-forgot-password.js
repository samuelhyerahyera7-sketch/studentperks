const { clean, escapeHtml, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest } = require('../../api/_supabase');
const { TOO_MANY, clientIp, recordAttempt, tooManyAttempts } = require('../../api/_security');
const { RESET_MINUTES, makeResetToken, sendPartnerEmail } = require('../../api/_partner-auth');

const DONE = "If that account exists, we've emailed a reset link to the email address StudentPerks has for it. It works for 30 minutes. No email? Contact StudentPerks.";

// Emails a partner a one-time password reset link. The answer is the same
// whether or not the account exists, so it can't be used to find usernames.
//   POST { username }  (username or the partner's email) -> { message }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  try {
    const body = await readBody(req);
    const input = clean(body.username);
    if (!input) return json(res, 400, { error: 'Please enter your username or email address.' });
    const byEmail = input.includes('@');
    const value = byEmail ? input.toLowerCase() : input.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const ipKey = `reset-ip:${clientIp(req)}`;
    const accountKey = `reset:${value}`;
    if (await tooManyAttempts([[ipKey, 5], [accountKey, 3]])) return json(res, 429, { error: TOO_MANY });
    await recordAttempt([ipKey, accountKey]);

    const filter = byEmail ? `email=ilike.${encodeURIComponent(value)}` : `code_prefix=eq.${encodeURIComponent(value)}`;
    const rows = await rest(`vendors?${filter}&active=eq.true&select=id,name,email,code_prefix,vendor_pin,vendor_pin_hash&limit=1`);
    const vendor = rows && rows[0];
    if (vendor && isApprovedLiveBusiness(vendor) && vendor.email) {
      const link = `https://studentperks.co.za/verify?reset=${encodeURIComponent(makeResetToken(vendor))}`;
      await sendPartnerEmail(vendor.email, 'Reset your StudentPerks partner password',
        `<p>Hi ${escapeHtml(vendor.name)},</p><p>Someone asked to reset the password for your StudentPerks partner login (username <strong>${escapeHtml(vendor.code_prefix)}</strong>).</p>
<p><a href="${link}" style="background:#9cff18;color:#050505;font-weight:700;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block">Choose a new password</a></p>
<p>This link works once, for ${RESET_MINUTES} minutes. If you didn't ask for this, you can ignore this email and your password stays the same.</p>`);
    }
    return json(res, 200, { message: DONE });
  } catch (error) {
    return json(res, 200, { message: DONE });
  }
};
