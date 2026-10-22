module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
  const email = body?.email || 'user@capcut.mock';

  return res.status(200).json({
    status: true,
    module: 'capcut-subscription.js',
    message: `Active subscription injected for account: ${email}`,
    data: {
      email,
      subscriptionId: 'sub_cc_' + Math.random().toString(36).substring(2, 10),
      planName: 'CapCut Pro Annual VIP',
      status: 'active',
      startedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2028-12-31T23:59:59Z'
    }
  });
};
