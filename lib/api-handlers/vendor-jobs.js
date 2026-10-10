const { clean, emailPrefLink, escapeHtml, isApprovedLiveBusiness, isEmail, json, readBody, requireServiceKey, rest, sendEmailBatch, verifyVendorToken } = require('../../api/_supabase');

const JOB_TYPES = ['Part-time', 'Full-time', 'Internship', 'Graduate programme', 'Vacation work', 'Freelance'];
const FIELDS = 'id,title,job_type,location,pay,description,apply_url,closes_on,active,created_at';

function tableMissing(error) {
  return /jobs/.test(String(error && error.message)) && (error.status === 404 || /does not exist|schema cache/i.test(String(error.message)));
}

// Partners list, post and close their student jobs from the portal's Jobs tab.
//   GET                       -> { jobs }
//   POST { action:'create', title, job_type, location, pay, description, apply_url, closes_on }
//   POST { action:'close', id }
// Email students who made a work profile and left job alerts on.
async function sendJobAlerts(job, partnerName) {
  if (!job) return 0;
  const students = await rest('student_profiles?job_alerts=eq.true&select=student_email,full_name&limit=5000').catch(() => []);
  if (!students || !students.length) return 0;
  const details = [job.job_type, job.location, job.pay].filter(Boolean).map(escapeHtml).join(' · ');
  const emails = students.map(s => {
    const first = escapeHtml(String(s.full_name || '').split(' ')[0] || 'there');
    const off = emailPrefLink(s.student_email, 'job_alerts');
    return {
      from: 'StudentPerks <notifications@studentperks.co.za>',
      to: [s.student_email],
      subject: `New job: ${job.title} at ${partnerName}`,
      headers: { 'List-Unsubscribe': `<${off}>` },
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0b0f19">
<p>Hi ${first},</p>
<p><strong>${escapeHtml(partnerName)}</strong> just posted a new job on StudentPerks:</p>
<div style="border:1px solid #e3e8ef;border-radius:14px;padding:16px;margin:16px 0">
<div style="font-size:18px;font-weight:700">${escapeHtml(job.title)}</div>
<div style="color:#5b6476;margin-top:4px">${details}</div>
<p style="margin:12px 0 0;line-height:1.5">${escapeHtml(job.description.slice(0, 300))}${job.description.length > 300 ? '…' : ''}</p>
</div>
<p><a href="https://studentperks.co.za/dashboard#jobs" style="background:#9cff18;color:#050505;font-weight:700;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block">See the job</a></p>
<p style="color:#8a93a3;font-size:12px;margin-top:28px">You're getting this because job alerts are on in your StudentPerks work profile. <a href="${off}" style="color:#8a93a3">Switch off job alerts</a></p>
</div>`
    };
  });
  return sendEmailBatch(emails);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const token = req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '';
  const vendorId = verifyVendorToken(token);
  if (!vendorId) return json(res, 401, { error: 'Vendor session expired. Please sign in again.' });

  try {
    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name`);
    if (!isApprovedLiveBusiness(vendorRows && vendorRows[0])) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });

    if (req.method === 'GET') {
      const jobs = await rest(`jobs?vendor_id=eq.${encodeURIComponent(vendorId)}&select=${FIELDS}&order=created_at.desc`);
      return json(res, 200, { jobs: jobs || [] });
    }

    const body = await readBody(req);
    if (body.action === 'close') {
      const id = clean(body.id);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'Unknown job.' });
      await rest(`jobs?id=eq.${id}&vendor_id=eq.${encodeURIComponent(vendorId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ active: false })
      });
      return json(res, 200, { closed: true });
    }

    const job = {
      vendor_id: vendorId,
      title: clean(body.title).slice(0, 120),
      job_type: JOB_TYPES.includes(clean(body.job_type)) ? clean(body.job_type) : 'Part-time',
      location: clean(body.location).slice(0, 120),
      pay: clean(body.pay).slice(0, 80),
      description: clean(body.description).slice(0, 3000),
      apply_url: clean(body.apply_url).slice(0, 500),
      closes_on: /^\d{4}-\d{2}-\d{2}$/.test(clean(body.closes_on)) ? clean(body.closes_on) : null
    };
    if (job.title.length < 3) return json(res, 400, { error: 'Please add a job title.' });
    if (job.description.length < 10) return json(res, 400, { error: 'Please describe the job in a sentence or two.' });
    if (!/^https:\/\/\S+\.\S+/i.test(job.apply_url) && !isEmail(job.apply_url)) {
      return json(res, 400, { error: 'Add where students should apply: a https:// link or an email address.' });
    }
    const rows = await rest(`jobs?select=${FIELDS}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(job)
    });
    const alerted = await sendJobAlerts(rows && rows[0], vendorRows[0].name).catch(() => 0);
    return json(res, 200, { job: rows && rows[0], alerted });
  } catch (error) {
    if (tableMissing(error)) return json(res, 503, { error: 'Job posting is not switched on yet. StudentPerks needs to finish setting it up.' });
    return json(res, 500, { error: 'Could not save the job. Please try again.' });
  }
};

module.exports.JOB_TYPES = JOB_TYPES;
