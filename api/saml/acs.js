const { parseAcsRequest, SITE_ORIGIN } = require('../_saml');
const { clean, rest, sendApplicationApprovedEmail } = require('../_supabase');

function redirect(res, params) {
  const query = new URLSearchParams(params).toString();
  res.statusCode = 302;
  res.setHeader('Location', `${SITE_ORIGIN}/?${query}`);
  res.end();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  let profile;
  try {
    ({ profile } = await parseAcsRequest(req));
  } catch (error) {
    return redirect(res, { safire: 'error', reason: error.message || 'invalid_response' });
  }

  if (!profile.email) {
    return redirect(res, { safire: 'error', reason: 'no_email' });
  }
  if (!profile.isStudent) {
    return redirect(res, { safire: 'error', reason: 'not_student' });
  }

  const email = profile.email;
  const ssoNote = `Auto-verified via SAFIRE SSO (${profile.affiliations.join(', ') || 'student'}) on ${new Date().toISOString()}.`;

  try {
    const filter = `or=(personal_email.ilike.${encodeURIComponent(email)},student_email.ilike.${encodeURIComponent(email)})`;
    const rows = await rest(`student_applications?${filter}&order=created_at.desc&limit=1&select=id,admin_notes,full_name`);
    const existing = rows && rows[0];

    if (existing) {
      const notes = clean(existing.admin_notes) ? `${existing.admin_notes}\n${ssoNote}` : ssoNote;
      await rest(`student_applications?id=eq.${existing.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'approved',
          student_email_verified: true,
          student_email: email,
          institution: profile.institution || undefined,
          admin_notes: notes
        })
      });
    } else {
      await rest('student_applications', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          full_name: profile.fullName || email,
          personal_email: email,
          student_email: email,
          institution: profile.institution || '',
          student_number: profile.studentNumber || '',
          student_email_verified: true,
          status: 'approved',
          admin_notes: ssoNote
        })
      });
    }

    sendApplicationApprovedEmail({ email, name: profile.fullName }).catch(() => {});
  } catch (error) {
    return redirect(res, { safire: 'error', reason: 'save_failed' });
  }

  return redirect(res, { safire: 'success', email });
};
