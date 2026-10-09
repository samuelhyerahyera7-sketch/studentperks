const { authUserEmail, clean, json, readBody, requireServiceKey, rest } = require('../../api/_supabase');

// Lets a signed-in student add their full name when their record has none:
// university logins don't always share a name, so those records start with
// the email address as the name. A real name is never overwritten here.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const token = req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '';
  const email = await authUserEmail(token).catch(() => '');
  if (!email) return json(res, 401, { error: 'Please sign in again.' });

  try {
    const body = await readBody(req);
    const name = clean(body.name).replace(/\s+/g, ' ');
    if (name.length < 3 || name.length > 80 || !/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(name) || !name.includes(' ')) {
      return json(res, 400, { error: 'Please enter your first name and surname.' });
    }
    const filter = `or=(personal_email.ilike.${encodeURIComponent(email)},student_email.ilike.${encodeURIComponent(email)})`;
    const rows = await rest(`student_applications?${filter}&order=created_at.desc&limit=1&select=id,full_name`);
    const record = rows && rows[0];
    if (!record) return json(res, 404, { error: 'We could not find your StudentPerks record.' });
    const current = clean(record.full_name);
    if (current && !current.includes('@')) return json(res, 409, { error: 'Your name is already on your record.' });

    await rest(`student_applications?id=eq.${record.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ full_name: name })
    });
    return json(res, 200, { name });
  } catch (error) {
    return json(res, 500, { error: 'Could not save your name. Please try again.' });
  }
};
