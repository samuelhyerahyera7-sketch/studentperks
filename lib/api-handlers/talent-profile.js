const { clean, json, readBody, requireServiceKey, rest } = require('../../api/_supabase');
const { OPTIONS, TEXT, age, currentStudent, forStudent, loadProfile } = require('../../api/_talent');

// A verified student's own work profile.
//   GET  -> { profile }
//   POST { ...fields, share_details, share_photos, share_race, adult_confirmed,
//          job_alerts, application_alerts, message_alerts } -> { profile }
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;
  const student = await currentStudent(req);
  if (student.error) return json(res, student.error[0], { error: student.error[1] });

  try {
    if (req.method === 'GET') return json(res, 200, { profile: await forStudent(await loadProfile(student.email)), options: OPTIONS });

    const body = await readBody(req);
    const row = { student_email: student.email, updated_at: new Date().toISOString() };
    for (const [field, max] of Object.entries(TEXT)) if (field in body) row[field] = clean(body[field]).slice(0, max);
    for (const [field, allowed] of Object.entries(OPTIONS)) {
      if (!(field in body)) continue;
      const value = clean(body[field]);
      if (value && !allowed.includes(value)) return json(res, 400, { error: `Please choose a valid ${field.replace(/_/g, ' ')}.` });
      row[field] = value;
    }
    if ('date_of_birth' in body) {
      const dob = clean(body.date_of_birth);
      if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || age(dob) < 15 || age(dob) > 70)) return json(res, 400, { error: 'Please enter a valid date of birth.' });
      row.date_of_birth = dob || null;
    }
    if ('height_cm' in body) {
      const h = parseInt(body.height_cm, 10);
      if (body.height_cm !== '' && body.height_cm !== null && (!(h >= 120 && h <= 230))) return json(res, 400, { error: 'Please enter your height in centimetres, e.g. 168.' });
      row.height_cm = Number.isFinite(h) ? h : null;
    }
    for (const field of ['job_alerts', 'application_alerts', 'message_alerts']) if (field in body) row[field] = !!body[field];

    const before = await loadProfile(student.email);
    const consentFields = ['share_details', 'share_photos', 'share_race', 'adult_confirmed'];
    const consent = Object.fromEntries(consentFields.map(f => [f, f in body ? !!body[f] : !!(before && before[f])]));
    if (consent.share_race && !row.race && !(before && before.race)) consent.share_race = false;
    const consentChanged = !before || consentFields.some(f => !!before[f] !== consent[f]);
    Object.assign(row, consent);
    if (consentChanged) row.consent_updated_at = new Date().toISOString();

    const saved = await rest('student_profiles?on_conflict=student_email&select=*', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row)
    });
    if (consentChanged) {
      await rest('consent_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ student_email: student.email, ...consent }) }).catch(() => {});
    }
    return json(res, 200, { profile: await forStudent(saved && saved[0]), options: OPTIONS });
  } catch (error) {
    if (/student_profiles/.test(String(error.message))) return json(res, 503, { error: 'Work profiles are being set up. Please try again soon.' });
    return json(res, 500, { error: 'Could not save your profile. Please try again.' });
  }
};
