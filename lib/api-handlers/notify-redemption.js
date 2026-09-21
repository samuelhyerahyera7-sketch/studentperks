function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  res.setHeader('Allow', 'POST');
  return json(res, 410, {
    error: 'This endpoint has been retired. Use /api/redeem-code or /api/vendor-redeem.'
  });
};
