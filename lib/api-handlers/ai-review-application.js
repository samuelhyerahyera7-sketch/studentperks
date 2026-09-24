const { clean, json, readBody, requireServiceKey, rest } = require('../../api/_supabase');
const { hasAiKey, reviewApplication, recordError } = require('../../api/_ai_verify');

const RECHECK_AFTER_MS = 10 * 60 * 1000;
const SELECT = 'id,full_name,personal_email,institution,student_number,year_of_study,degree_course,card_photo_url,status,admin_notes,ai_checked_at';

// POST { email }  — called by the join form right after a card upload;
//                   checks that student's newest pending application once.
// POST { id }     — "Re-run AI check" from the admin dashboard; allowed for
//                   pending applications at most once every 10 minutes so
//                   the endpoint can't be used to run up the AI bill.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;
  if (!hasAiKey()) return json(res, 200, { skipped: true, reason: 'No AI key configured (set XAI_API_KEY for Grok).' });

  let app;
  try {
    const body = await readBody(req);
    const id = clean(body.id);
    const email = clean(body.email).toLowerCase();
    if (id) {
      const rows = await rest(`student_applications?id=eq.${encodeURIComponent(id)}&select=${SELECT}`);
      app = rows && rows[0];
      if (!app) return json(res, 404, { error: 'Application not found.' });
      if (app.status !== 'pending') return json(res, 409, { error: 'Only pending applications can be re-checked.' });
      if (app.ai_checked_at && Date.now() - Date.parse(app.ai_checked_at) < RECHECK_AFTER_MS) {
        return json(res, 429, { error: 'This application was checked in the last 10 minutes. Try again shortly.' });
      }
    } else if (email) {
      const rows = await rest(
        `student_applications?personal_email=ilike.${encodeURIComponent(email)}` +
        `&status=eq.pending&ai_checked_at=is.null&card_photo_url=neq.&order=created_at.desc&limit=1&select=${SELECT}`
      );
      app = rows && rows[0];
      if (!app) return json(res, 200, { skipped: true, reason: 'Nothing to check.' });
    } else {
      return json(res, 400, { error: 'Send an application id or email.' });
    }

    const result = await reviewApplication(app);
    return json(res, 200, result);
  } catch (error) {
    if (app) await recordError(app, error);
    return json(res, 500, { error: error.message || 'AI check failed.' });
  }
};
