const { clean, json, membershipExpiry, membershipStatus, readBody, requireServiceKey, rest } = require('../../api/_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  try {
    const body = await readBody(req);
    const email = clean(body.email);
    if (!email) return json(res, 400, { error: 'Email is required.' });

    const filter = `or=(personal_email.ilike.${encodeURIComponent(email)},student_email.ilike.${encodeURIComponent(email)})`;
    const rows = await rest(`student_applications?${filter}&order=created_at.desc&limit=1&select=status,reviewed_at,created_at`);
    const app = rows && rows[0];
    // status is 'expired' once an approved membership is more than a year old.
    return json(res, 200, { found: !!app, status: app ? membershipStatus(app) : null, expiresAt: app && app.status === 'approved' ? membershipExpiry(app) : null });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not check application status.' });
  }
};
