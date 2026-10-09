const { isApprovedLiveBusiness, json, requireServiceKey, rest } = require('../../api/_supabase');

// Live student jobs for the homepage: active, not past their closing date,
// and posted by a live partner.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await rest(
      `jobs?active=eq.true&or=(closes_on.is.null,closes_on.gte.${today})` +
      '&select=id,title,job_type,location,pay,description,apply_url,closes_on,created_at,vendors(name)' +
      '&order=created_at.desc&limit=50'
    );
    const jobs = (rows || [])
      .filter(job => isApprovedLiveBusiness(job.vendors))
      .map(({ vendors, ...job }) => ({ ...job, company: vendors.name }));
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return json(res, 200, { jobs });
  } catch (error) {
    // Before add-jobs.sql has been run there is simply nothing to list.
    return json(res, 200, { jobs: [] });
  }
};
