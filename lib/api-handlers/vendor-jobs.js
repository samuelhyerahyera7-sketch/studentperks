const { clean, isApprovedLiveBusiness, isEmail, json, readBody, requireServiceKey, rest, verifyVendorToken } = require('../../api/_supabase');

const JOB_TYPES = ['Part-time', 'Full-time', 'Internship', 'Graduate programme', 'Vacation work', 'Freelance'];
const FIELDS = 'id,title,job_type,location,pay,description,apply_url,closes_on,active,created_at';

function tableMissing(error) {
  return /jobs/.test(String(error && error.message)) && (error.status === 404 || /does not exist|schema cache/i.test(String(error.message)));
}

// Partners list, post and close their student jobs from the portal's Jobs tab.
//   GET                       -> { jobs }
//   POST { action:'create', title, job_type, location, pay, description, apply_url, closes_on }
//   POST { action:'close', id }
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
    return json(res, 200, { job: rows && rows[0] });
  } catch (error) {
    if (tableMissing(error)) return json(res, 503, { error: 'Job posting is not switched on yet. StudentPerks needs to finish setting it up.' });
    return json(res, 500, { error: 'Could not save the job. Please try again.' });
  }
};

module.exports.JOB_TYPES = JOB_TYPES;
