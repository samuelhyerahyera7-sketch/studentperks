const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function clean(value) {
  return String(value || '').trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildStudentHtml({ code, vendorName, discount, redeemedAt }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2>Your StudentPerks discount was retrieved</h2>
      <p>Your discount code has been marked as redeemed.</p>
      <p><strong>Vendor:</strong> ${escapeHtml(vendorName)}</p>
      <p><strong>Discount:</strong> ${escapeHtml(discount || 'StudentPerks offer')}</p>
      <p><strong>Code:</strong> <span style="font-family:monospace">${escapeHtml(code)}</span></p>
      <p><strong>Time:</strong> ${escapeHtml(redeemedAt)}</p>
      <p>If this was not you, please contact StudentPerks support.</p>
    </div>
  `;
}

function buildVendorHtml({ code, vendorName, studentEmail, studentName, discount, redeemedAt }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2>A StudentPerks discount was retrieved</h2>
      <p>A student has retrieved one of your discount codes.</p>
      <p><strong>Vendor:</strong> ${escapeHtml(vendorName)}</p>
      <p><strong>Discount:</strong> ${escapeHtml(discount || 'StudentPerks offer')}</p>
      <p><strong>Code:</strong> <span style="font-family:monospace">${escapeHtml(code)}</span></p>
      <p><strong>Student:</strong> ${escapeHtml(studentName || 'Not provided')}</p>
      <p><strong>Email:</strong> ${escapeHtml(studentEmail || 'Not provided')}</p>
      <p><strong>Time:</strong> ${escapeHtml(redeemedAt)}</p>
    </div>
  `;
}

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REDEMPTION_EMAIL_FROM || 'StudentPerks <notifications@studentperks.co.za>';

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, html })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend failed: ${response.status} ${text}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return json(res, 501, { error: 'Email provider is not configured.' });
  }

  let body;
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch {
    return json(res, 400, { error: 'Invalid JSON body.' });
  }

  const payload = {
    code: clean(body.code),
    vendorName: clean(body.vendorName),
    vendorEmail: clean(body.vendorEmail),
    studentEmail: clean(body.studentEmail),
    studentName: clean(body.studentName),
    discount: clean(body.discount),
    redeemedAt: clean(body.redeemedAt)
  };

  if (!payload.code || !payload.vendorName) {
    return json(res, 400, { error: 'Code and vendor name are required.' });
  }

  const sends = [];
  if (isEmail(payload.studentEmail)) {
    sends.push(sendEmail({
      to: payload.studentEmail,
      subject: `Your StudentPerks discount from ${payload.vendorName}`,
      html: buildStudentHtml(payload)
    }));
  }

  if (isEmail(payload.vendorEmail)) {
    sends.push(sendEmail({
      to: payload.vendorEmail,
      subject: `StudentPerks code retrieved: ${payload.code}`,
      html: buildVendorHtml(payload)
    }));
  }

  if (!sends.length) {
    return json(res, 202, { sent: 0, message: 'No valid recipient emails were provided.' });
  }

  try {
    await Promise.all(sends);
    return json(res, 200, { sent: sends.length });
  } catch (error) {
    return json(res, 502, { error: error.message || 'Failed to send notification email.' });
  }
};
