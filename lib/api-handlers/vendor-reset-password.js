const { clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest } = require('../../api/_supabase');
const { TOO_MANY, clientIp, hashSecret, recordAttempt, tooManyAttempts } = require('../../api/_security');
const { loginChangedEmail, passwordFingerprint, readResetToken } = require('../../api/_partner-auth');

// Sets a new partner password from an emailed reset link.
//   POST { token, pin } -> { username }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  try {
    const body = await readBody(req);
    const ipKey = `reset-ip:${clientIp(req)}`;
    if (await tooManyAttempts([[ipKey, 10]])) return json(res, 429, { error: TOO_MANY });

    const reset = readResetToken(clean(body.token));
    const expired = { error: 'This reset link has expired or was already used. Please ask for a new one.' };
    if (!reset) { await recordAttempt([ipKey]); return json(res, 400, expired); }
    const pin = clean(body.pin);
    if (pin.length < 8) return json(res, 400, { error: 'New password must be at least 8 characters.' });

    const rows = await rest(`vendors?id=eq.${encodeURIComponent(reset.vendorId)}&active=eq.true&select=id,name,email,code_prefix,vendor_pin,vendor_pin_hash&limit=1`);
    const vendor = rows && rows[0];
    if (!vendor || !isApprovedLiveBusiness(vendor) || passwordFingerprint(vendor) !== reset.fingerprint) return json(res, 400, expired);

    await rest(`vendors?id=eq.${encodeURIComponent(vendor.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ vendor_pin: '', vendor_pin_hash: hashSecret(pin) })
    });
    await loginChangedEmail(vendor, { password: true });
    return json(res, 200, { username: vendor.code_prefix });
  } catch (error) {
    return json(res, 500, { error: 'Could not reset the password. Please try again.' });
  }
};
