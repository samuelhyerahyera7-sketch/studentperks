const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bulmerqkvvrjvzjwmgkl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VENDOR_SESSION_SECRET = process.env.VENDOR_SESSION_SECRET || SERVICE_KEY;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function clean(value) {
  return String(value || '').trim();
}

function normalizeBusinessName(name) {
  return clean(name).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '').trim();
}

function isApprovedLiveBusinessName(name) {
  const normalized = normalizeBusinessName(name);
  return normalized === 'cratesandboxes' || normalized === 'custommugs' || normalized === 'custommugssa';
}

function isApprovedLiveBusiness(vendor) {
  return isApprovedLiveBusinessName(vendor && vendor.name);
}

function requireServiceKey(res) {
  if (SERVICE_KEY) return true;
  json(res, 500, { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' });
  return false;
}

async function readBody(req) {
  if (typeof req.body === 'object' && req.body) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function rest(path, options = {}) {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data && (data.message || data.error) ? (data.message || data.error) : text;
    const error = new Error(message || `Supabase request failed with ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function signVendor(vendorId) {
  const payload = Buffer.from(JSON.stringify({
    vendorId,
    exp: Date.now() + 1000 * 60 * 60 * 12
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', VENDOR_SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyVendorToken(token) {
  const [payload, sig] = clean(token).split('.');
  if (!payload || !sig || !VENDOR_SESSION_SECRET) return null;
  const expected = crypto.createHmac('sha256', VENDOR_SESSION_SECRET).update(payload).digest('base64url');
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!parsed.vendorId || parsed.exp < Date.now()) return null;
  return parsed.vendorId;
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

async function sendRedemptionEmails(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, skipped: true };

  const from = process.env.REDEMPTION_EMAIL_FROM || 'StudentPerks <notifications@studentperks.co.za>';
  const sends = [];
  const base = `
    <p><strong>Vendor:</strong> ${escapeHtml(payload.vendorName)}</p>
    <p><strong>Discount:</strong> ${escapeHtml(payload.discount || 'StudentPerks offer')}</p>
    <p><strong>Code:</strong> <span style="font-family:monospace">${escapeHtml(payload.code)}</span></p>
    <p><strong>Time:</strong> ${escapeHtml(payload.redeemedAt)}</p>
  `;

  if (isEmail(payload.studentEmail)) {
    sends.push({
      to: payload.studentEmail,
      subject: `Your StudentPerks discount from ${payload.vendorName}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><h2>Your StudentPerks discount was retrieved</h2>${base}<p>If this was not you, please contact StudentPerks support.</p></div>`
    });
  }

  if (isEmail(payload.vendorEmail)) {
    sends.push({
      to: payload.vendorEmail,
      subject: `StudentPerks code retrieved: ${payload.code}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><h2>A StudentPerks discount was retrieved</h2>${base}<p><strong>Student:</strong> ${escapeHtml(payload.studentName || 'Not provided')}</p><p><strong>Email:</strong> ${escapeHtml(payload.studentEmail || 'Not provided')}</p></div>`
    });
  }

  await Promise.all(sends.map(email => fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, ...email })
  }).then(async response => {
    if (!response.ok) throw new Error(`Resend failed: ${response.status} ${await response.text()}`);
  })));

  return { sent: sends.length };
}

module.exports = {
  clean,
  isApprovedLiveBusiness,
  isApprovedLiveBusinessName,
  json,
  normalizeBusinessName,
  readBody,
  requireServiceKey,
  rest,
  sendRedemptionEmails,
  signVendor,
  verifyVendorToken
};
