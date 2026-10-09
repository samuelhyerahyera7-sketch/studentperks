const { normalizeBusinessName } = require('./_supabase');

// The single checkout code each partner gave StudentPerks. Kept on the
// server only: pages ask /api/deal-code (verified students) or receive it
// with their partner session, so the codes are not in any public page.
const PARTNER_CODES = {
  justprotein: 'JP-STUPERK15',
  terbodore: 'studentperks20',
  terbodorecoffee: 'studentperks20',
  intercity: 'STUDENTPERKS2X',
  intercityxpress: 'STUDENTPERKS2X',
  custommugs: 'MUGS10',
  custommugssa: 'MUGS10',
  // Presentation demo account (partner portal): shows Intercity's code, as requested
  studentperks: 'STUDENTPERKS2X'
};

// Same rule the pages used before: a partner's own code if we have one,
// otherwise its code prefix followed by the discount number.
function sharedCodeFor(vendor) {
  const key = normalizeBusinessName(vendor && vendor.name);
  if (PARTNER_CODES[key]) return PARTNER_CODES[key];
  const prefix = String(vendor && vendor.code_prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digits = String(vendor && vendor.discount_desc || '').match(/\d+/);
  return prefix ? `${prefix}${digits ? digits[0] : ''}` : '';
}

module.exports = { sharedCodeFor };
