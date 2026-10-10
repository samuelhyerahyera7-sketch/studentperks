const { normalizeBusinessName, rest } = require('./_supabase');

// The single checkout code each partner gave StudentPerks. The codes live in
// the database (app_settings, key "partner_codes", a JSON object of
// normalised business name -> code), never in this public repository.
// Pages ask /api/deal-code (verified students) or receive the code with
// their partner session.
let cache = { at: 0, codes: null };

async function partnerCodes() {
  if (cache.codes && Date.now() - cache.at < 60 * 1000) return cache.codes;
  const rows = await rest('app_settings?key=eq.partner_codes&select=value&limit=1').catch(() => null);
  let codes = null;
  try { codes = rows && rows[0] ? JSON.parse(rows[0].value) : null; } catch (error) { codes = null; }
  cache = { at: Date.now(), codes };
  return codes;
}

// A partner's own code if we have one, otherwise its code prefix followed by
// the discount number. Nothing at all until the codes have been stored.
async function sharedCodeFor(vendor) {
  const codes = await partnerCodes();
  if (!codes) return '';
  const key = normalizeBusinessName(vendor && vendor.name);
  if (codes[key]) return String(codes[key]);
  const prefix = String(vendor && vendor.code_prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digits = String(vendor && vendor.discount_desc || '').match(/\d+/);
  return prefix ? `${prefix}${digits ? digits[0] : ''}` : '';
}

module.exports = { sharedCodeFor };
