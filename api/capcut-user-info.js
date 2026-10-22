module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    status: true,
    module: 'capcut-user-info.js',
    message: 'User profile fetched with custom VIP payload.',
    data: {
      userId: 'cc_uid_99887766',
      name: 'Morgan VIP Pro',
      vipType: 2,
      isPro: true,
      avatarDecor: 'gold_crown_animated'
    }
  });
};
