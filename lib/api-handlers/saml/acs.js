const { parseAcsRequest, SITE_ORIGIN } = require('../../../api/_saml');
const { clean, createInstantLoginLink, membershipStatus, rest, sendApplicationApprovedEmail } = require('../../../api/_supabase');

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
  let wasActive = false;
  const ssoNote = `Auto-verified via SAFIRE SSO (${profile.affiliations.join(', ') || 'student'}) on ${new Date().toISOString()}.`;

  try {
    const filter = `or=(personal_email.ilike.${encodeURIComponent(email)},student_email.ilike.${encodeURIComponent(email)})`;
    const rows = await rest(`student_applications?${filter}&order=created_at.desc&limit=1&select=id,admin_notes,full_name,status,reviewed_at,created_at`);
    const existing = rows && rows[0];
    // Only email "you're verified" when this login actually (re)activates the
    // membership, not on every routine university login.
    wasActive = membershipStatus(existing) === 'approved';

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
          // Fill in the name from the university if we only had the email.
          full_name: profile.fullName && (!clean(existing.full_name) || clean(existing.full_name).toLowerCase() === email) ? profile.fullName : undefined,
          // A university login re-verifies the student, renewing their year.
          reviewed_at: new Date().toISOString(),
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
          reviewed_at: new Date().toISOString(),
          admin_notes: ssoNote
        })
      });
    }

    if (!wasActive) sendApplicationApprovedEmail({ email, name: profile.fullName }).catch(() => {});
  } catch (error) {
    // The student only ever sees a friendly message for save_failed; the
    // detail param (and the log line) is there so the cause is diagnosable.
    console.error('SAFIRE ACS save failed:', error.status, error.message, error.details);
    return redirect(res, { safire: 'error', reason: 'save_failed', detail: String(error.message || '').slice(0, 160) });
  }

  // The university has just confirmed who this is, so sign them straight in
  // and land them on their dashboard. If that isn't possible, fall back to
  // the homepage, which emails them a sign-in link.
  const loginLink = await createInstantLoginLink(email, `${SITE_ORIGIN}/dashboard`);
  if (loginLink) {
    res.statusCode = 302;
    res.setHeader('Location', loginLink);
    return res.end();
  }
  return redirect(res, { safire: 'success', email });
};
