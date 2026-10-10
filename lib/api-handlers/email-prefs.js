const { EMAIL_PREFS, clean, escapeHtml, requireServiceKey, rest, verifyEmailPrefToken } = require('../../api/_supabase');

const LABELS = { job_alerts: 'new job alerts', application_alerts: 'application updates', message_alerts: 'message alerts' };

function page(res, status, title, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · StudentPerks</title>
<style>body{font-family:Inter,system-ui,sans-serif;background:#f6f8fb;color:#0b0f19;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}main{background:#fff;border:1px solid #e3e8ef;border-radius:20px;padding:28px;max-width:440px;text-align:center}h1{font-size:24px;margin:0 0 8px}p{color:#5b6476;line-height:1.5}a{display:inline-block;margin-top:12px;background:#9cff18;color:#050505;font-weight:800;padding:12px 20px;border-radius:999px;text-decoration:none}</style></head>
<body><main><h1>${escapeHtml(title)}</h1><p>${body}</p><a href="https://studentperks.co.za/dashboard#jobs">Open my dashboard</a></main></body></html>`);
}

// One-click unsubscribe from a type of StudentPerks email, from the link in
// the email itself (signed, so it can't switch off someone else's emails).
module.exports = async function handler(req, res) {
  if (!requireServiceKey(res)) return;
  const url = new URL(req.url, 'https://studentperks.co.za');
  const email = clean(url.searchParams.get('e')).toLowerCase();
  const pref = clean(url.searchParams.get('p'));
  const token = clean(url.searchParams.get('t'));
  if (!email || !EMAIL_PREFS.includes(pref) || !verifyEmailPrefToken(email, pref, token)) {
    return page(res, 400, 'Link not valid', 'This unsubscribe link is incomplete. You can switch emails off in your StudentPerks dashboard under Jobs → Email alerts.');
  }
  try {
    await rest(`student_profiles?student_email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ [pref]: false, updated_at: new Date().toISOString() })
    });
    return page(res, 200, 'You\'re unsubscribed', `You won't get ${escapeHtml(LABELS[pref])} any more. You can switch them back on any time in your dashboard under Jobs → Email alerts.`);
  } catch (error) {
    return page(res, 500, 'Something went wrong', 'Please try again, or switch emails off in your dashboard under Jobs → Email alerts.');
  }
};
