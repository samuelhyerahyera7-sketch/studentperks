const { authUserEmail, bearer, json, latestApplication, membershipStatus, readBody, requireServiceKey, rest } = require('../../api/_supabase');
const { sharedCodeFor } = require('../../api/_deal-codes');
const { dealName } = require('./track');

// Hands a deal's checkout code to a signed-in, approved (not expired)
// student and records who received it. The codes are no longer in any page.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const email = await authUserEmail(bearer(req)).catch(() => '');
  if (!email) return json(res, 401, { error: 'Please sign in to get this code.' });

  try {
    const body = await readBody(req);
    const deal = dealName(body.deal);
    if (!deal) return json(res, 404, { error: 'This offer is not available.' });

    const application = await latestApplication(email);
    const status = membershipStatus(application);
    if (status === 'expired') return json(res, 403, { error: 'Your StudentPerks membership has expired. Renew it to use deals.', status });
    if (status !== 'approved') return json(res, 403, { error: 'Your account is still being verified. Deals unlock once approved.', status });

    const vendors = await rest(`vendors?select=name,code_prefix,discount_desc&active=eq.true`);
    const vendor = (vendors || []).find(v => dealName(v.name) === deal) || { name: deal };
    const code = await sharedCodeFor(vendor);
    if (!code) return json(res, 404, { error: 'This offer has no code yet.' });

    const source = ['home', 'dashboard'].includes(body.source) ? body.source : '';
    const event = { deal, event: 'code', source, student_email: email };
    await rest('deal_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(event) })
      .catch(() => rest('deal_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deal, event: 'code', source }) }))
      .catch(() => {});
    return json(res, 200, { deal, code });
  } catch (error) {
    return json(res, 500, { error: 'Could not load this code. Please try again.' });
  }
};
