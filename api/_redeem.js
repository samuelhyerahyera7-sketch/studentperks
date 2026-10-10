const { rest, sendRedemptionEmails } = require('./_supabase');

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Marks a coupon used and records the redemption as one step:
// - the coupon is only claimed if it is still unused (so two scans at the
//   same moment can't both succeed),
// - if recording the redemption fails, the coupon is released again,
// - emails are sent afterwards and can't turn a success into an error.
// Returns the redemption time, or null if the code was already used.
async function redeemCoupon(coupon, studentEmail) {
  const vendor = coupon.vendors || {};
  const now = new Date().toISOString();
  const claimed = await rest(`coupon_codes?id=eq.${encodeURIComponent(coupon.id)}&is_used=not.is.true&select=id`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ is_used: true, used_at: now })
  });
  if (!claimed || !claimed.length) return null;

  try {
    await rest('redemptions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        code: coupon.code,
        vendor_id: coupon.vendor_id,
        vendor_name: coupon.vendor_name || vendor.name || '',
        student_email: studentEmail || ''
      })
    });
  } catch (error) {
    await rest(`coupon_codes?id=eq.${encodeURIComponent(coupon.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_used: false, used_at: null })
    }).catch(() => {});
    throw error;
  }

  await sendRedemptionEmails({
    code: coupon.code,
    vendorName: coupon.vendor_name || vendor.name || '',
    vendorEmail: vendor.email || '',
    studentEmail: studentEmail || '',
    studentName: coupon.assigned_to_name || '',
    discount: vendor.discount_desc || '',
    redeemedAt: formatDate(now)
  }).catch(() => {});
  return now;
}

module.exports = { redeemCoupon };
