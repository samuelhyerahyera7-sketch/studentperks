const { clean, json, readBody, requireServiceKey, rest, sendNewApplicationEmail } = require('../../api/_supabase');
const { recordAttempt, tooManyAttempts } = require('../../api/_security');

// Tells the admin a student just applied. The details come from the
// database, not the request, and only for a pending application made in
// the last 30 minutes, once per application.
//   POST { email } -> { sent }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  try {
    const body = await readBody(req);
    const email = clean(body.email).toLowerCase();
    if (!email) return json(res, 400, { error: 'Email is required.' });
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const rows = await rest(`student_applications?personal_email=eq.${encodeURIComponent(email)}&status=eq.pending&created_at=gte.${since}&select=id,full_name,personal_email,student_email,institution&order=created_at.desc&limit=1`);
    const app = rows && rows[0];
    if (!app) return json(res, 200, { sent: 0, skipped: true });

    const key = `notify-new:${app.id}`;
    if (await tooManyAttempts([[key, 1]])) return json(res, 200, { sent: 0, skipped: true });
    await recordAttempt([key]);
    const result = await sendNewApplicationEmail({
      name: app.full_name || '',
      email: app.personal_email || '',
      studentEmail: app.student_email || '',
      institution: app.institution || ''
    });
    return json(res, 200, result);
  } catch (error) {
    return json(res, 500, { error: 'Could not send notification email.' });
  }
};
