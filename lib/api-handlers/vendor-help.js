const { clean, isApprovedLiveBusiness, isEmail, json, readBody, requireServiceKey, rest, sendVendorHelpEmail, verifyVendorToken } = require('../../api/_supabase');

// A signed-in partner asks StudentPerks for help from the portal's Help tab;
// the request is emailed to the StudentPerks admin with reply-to set to the
// partner, so answering the email goes straight back to them.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;

  const token = req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '';
  const vendorId = verifyVendorToken(token);
  if (!vendorId) return json(res, 401, { error: 'Your session expired. Please sign in again.' });

  try {
    const body = await readBody(req);
    const replyTo = clean(body.email);
    const message = clean(body.message).slice(0, 3000);
    const phone = clean(body.phone).slice(0, 40);
    if (!isEmail(replyTo)) return json(res, 400, { error: 'Please enter an email address we can reply to.' });
    if (message.length < 5) return json(res, 400, { error: 'Please tell us what you need help with.' });

    const vendorRows = await rest(`vendors?id=eq.${encodeURIComponent(vendorId)}&active=eq.true&select=id,name,code_prefix`);
    const vendor = vendorRows && vendorRows[0];
    if (!isApprovedLiveBusiness(vendor)) return json(res, 403, { error: 'This business dashboard is not available on the live StudentPerks site.' });

    await sendVendorHelpEmail({ vendorName: vendor.name, codePrefix: vendor.code_prefix, replyTo, phone, message });
    return json(res, 200, { sent: true });
  } catch (error) {
    return json(res, 500, { error: 'Could not send your message. Please email admin@studentperks.co.za or WhatsApp us.' });
  }
};
