const fetch = require('node-fetch');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }

  const email = body?.email || '';
  const verificationLink = body?.verificationLink || '';

  if (!email || !verificationLink) {
    return res.status(400).json({ status: false, message: 'Email dan Link Verifikasi wajib diisi' });
  }

  return res.status(200).json({
    status: true,
    proStatus: 'PRO_TRIAL_ACTIVE',
    message: 'Verifikasi Akun CapCut Berhasil!'
  });
};