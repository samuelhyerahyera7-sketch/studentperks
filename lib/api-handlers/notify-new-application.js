const { clean, json, readBody, sendNewApplicationEmail } = require('../../api/_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readBody(req);
    const result = await sendNewApplicationEmail({
      name: clean(body.name),
      email: clean(body.email),
      studentEmail: clean(body.studentEmail),
      institution: clean(body.institution)
    });
    return json(res, 200, result);
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not send notification email.' });
  }
};
