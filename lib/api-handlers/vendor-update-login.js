const { clean, isApprovedLiveBusiness, json, readBody, requireServiceKey, rest, signVendor, verifyVendorToken } = require('../../api/_supabase');
const { TOO_MANY, clientIp, hashSecret, recordAttempt, tooManyAttempts } = require('../../api/_security');
const { loginChangedEmail, partnerPasswordOk } = require('../../api/_partner-auth');
const { sharedCodeFor } = require('../../api/_deal-codes');

const FIELDS = 'id,name,email,code_prefix,discount_desc,active';

// A signed-in partner changes their username and/or password. Their current
// password is required, and they're emailed about the change.
//   POST { currentPin, codePrefix, pin } -> { vendor, token }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const vendorId = verifyVendorToken(req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '');
  if (!vendorId) return json(res, 401, { error: 'Vendor session expired. Please sign in again.' });

  try {
    const body = await readBody(req);
    const current = clean(body.currentPin);
    const codePrefix = clean(body.codePrefix).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const pin = clean(body.pin);
    if (!current) return json(res, 400, { error: 'Please enter your current password.' });
    if (!codePrefix || codePrefix.length < 3) return json(res, 400, { error: 'Username must be at least 3 letters or numbers.' });
    if (pin && pin.length < 8) return json(res, 400, { error: 'New password must be at least 8 characters.' });

    const ipKey = `vendor-ip:${clientIp(req)}`;
    const accountKey = `vendor-id:${vendorId}`;
    if (await tooManyAttempts([[ipKey, 20], [accountKey, 10]])) return json(res, 429, { error: TOO_MANY });

    const rows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=${FIELDS},vendor_pin,vendor_pin_hash`);
    const found = rows && rows[0];
    if (!isApprovedLiveBusiness(found)) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });
    if (!partnerPasswordOk(found, current)) {
      await recordAttempt([ipKey, accountKey]);
      return json(res, 400, { error: 'Your current password is incorrect.' });
    }

    const usernameChanged = codePrefix !== found.code_prefix;
    if (!usernameChanged && !pin) return json(res, 400, { error: 'Nothing to change. Enter a new username or a new password.' });
    if (usernameChanged) {
      const duplicates = await rest(`vendors?code_prefix=eq.${encodeURIComponent(codePrefix)}&id=neq.${encodeURIComponent(vendorId)}&select=id`);
      if (duplicates && duplicates.length) return json(res, 409, { error: 'That username is already taken.' });
    }

    const changes = { code_prefix: codePrefix };
    if (pin) Object.assign(changes, { vendor_pin: '', vendor_pin_hash: hashSecret(pin) });
    const updatedRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&select=${FIELDS}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(changes)
    });
    const updated = updatedRows && updatedRows[0];
    await loginChangedEmail(updated || found, { username: usernameChanged, password: !!pin });
    return json(res, 200, { vendor: updated && { ...updated, shared_code: await sharedCodeFor(updated) }, token: signVendor(vendorId) });
  } catch (error) {
    return json(res, 500, { error: 'Could not update login details. Please try again.' });
  }
};
