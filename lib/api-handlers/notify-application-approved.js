const { bearer, clean, json, readBody, requireServiceKey, rest, sendApplicationApprovedEmail, verifyAdminToken } = require('../../api/_supabase');

// "You're verified" email. Only the admin can trigger it, only for an
// application that is approved in the database, and only to the email on
// that application.
//   POST { applicationId } (admin) -> { sent }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;
  if (!verifyAdminToken(bearer(req))) return json(res, 401, { error: 'Admin session expired. Please sign in again.' });

  try {
    const body = await readBody(req);
    const id = clean(body.applicationId);
    if (!/^[0-9a-z-]{1,64}$/i.test(id)) return json(res, 400, { error: 'Unknown application.' });
    const rows = await rest(`student_applications?id=eq.${encodeURIComponent(id)}&select=full_name,personal_email,status&limit=1`);
    const app = rows && rows[0];
    if (!app || app.status !== 'approved') return json(res, 409, { error: 'This application is not approved.' });
    const result = await sendApplicationApprovedEmail({ name: app.full_name || '', email: app.personal_email || '' });
    return json(res, 200, result);
  } catch (error) {
    return json(res, 500, { error: 'Could not send approval email.' });
  }
};
