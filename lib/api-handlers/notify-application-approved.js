const { clean, json, readBody, sendApplicationApprovedEmail } = require('../../api/_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readBody(req);
    const result = await sendApplicationApprovedEmail({
      name: clean(body.name),
      email: clean(body.email)
    });
    return json(res, 200, result);
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not send approval email.' });
  }
};
