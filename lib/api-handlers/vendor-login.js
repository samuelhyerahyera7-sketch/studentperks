const { clean, isApprovedLiveBusiness, isDemoVendor, json, readBody, requireServiceKey, rest, signVendor } = require('../../api/_supabase');
const { TOO_MANY, clientIp, hashSecret, recordAttempt, sameString, tooManyAttempts, verifySecret } = require('../../api/_security');
const { sharedCodeFor } = require('../../api/_deal-codes');

const FIELDS = 'id,name,email,code_prefix,discount_desc,active';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  try {
    const body = await readBody(req);
    const prefix = clean(body.prefix).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const pin = clean(body.pin);
    if (!prefix || !pin) return json(res, 400, { error: 'Vendor code and PIN are required.' });

    const ipKey = `vendor-ip:${clientIp(req)}`;
    const accountKey = `vendor:${prefix}`;
    if (await tooManyAttempts([[ipKey, 20], [accountKey, 10]])) return json(res, 429, { error: TOO_MANY });

    const rows = await rest(`vendors?code_prefix=eq.${encodeURIComponent(prefix)}&active=eq.true&select=${FIELDS},vendor_pin,vendor_pin_hash&limit=1`);
    const found = rows && rows[0];
    const ok = !!found && (found.vendor_pin_hash
      ? verifySecret(pin, found.vendor_pin_hash)
      : !!found.vendor_pin && sameString(pin, found.vendor_pin));
    if (!ok) {
      await recordAttempt([ipKey, accountKey]);
      return json(res, 401, { error: 'Incorrect vendor code or PIN.' });
    }
    // PINs saved before hashing: store the hash and clear the plain PIN.
    if (!found.vendor_pin_hash) {
      await rest(`vendors?id=eq.${encodeURIComponent(found.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ vendor_pin_hash: hashSecret(pin), vendor_pin: '' })
      }).catch(() => {});
    }

    const { vendor_pin, vendor_pin_hash, ...vendor } = found;
    if (!isApprovedLiveBusiness(vendor) && !isDemoVendor(vendor)) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });
    return json(res, 200, { vendor: { ...vendor, shared_code: await sharedCodeFor(vendor) }, token: signVendor(vendor.id) });
  } catch (error) {
    return json(res, 500, { error: 'Vendor sign-in failed. Please try again.' });
  }
};
