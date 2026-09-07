const { json, requireServiceKey, rest } = require('./_supabase');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bulmerqkvvrjvzjwmgkl.supabase.co';

async function getUserEmail(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) return '';
  const user = await response.json();
  return user && user.email ? String(user.email).trim() : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const accessToken = req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '';
  if (!accessToken) return json(res, 401, { error: 'Missing student session.' });

  try {
    const email = await getUserEmail(accessToken);
    if (!email) return json(res, 401, { error: 'Invalid student session.' });
    await rest(`student_applications?student_email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ student_email_verified: true })
    });
    return json(res, 200, { verified: true });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'Could not verify student email.' });
  }
};
