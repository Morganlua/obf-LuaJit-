const fetch = require('node-fetch');
const BASE_GENEMAIL = 'https://generator.email';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }

  const email = body?.email || '';
  const hpCookieHeader = body?.hpCookieHeader || '';
  if (!email) return res.status(400).json({ status: false, message: 'Email wajib diisi' });

  const [user, domain] = email.split('@');
  const ctx = encodeURIComponent(`${domain}/${user}/`);
  const cookies = `inbox_ctx=${ctx}; ${hpCookieHeader}`;

  try {
    const response = await fetch(`${BASE_GENEMAIL}/inbox1/`, { headers: { 'User-Agent': UA, 'Cookie': cookies }, timeout: 10000 });
    const html = await response.text();

    const links = html.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    const realLinks = links.filter(l => !l.includes('open?upn=') && !l.includes('1x1') && (l.includes('capcut') || l.includes('bytedance') || l.includes('auth') || l.includes('verify')));
    const verificationLink = realLinks.length > 0 ? realLinks[0] : (links.find(l => l.includes('capcut') || l.includes('bytedance')) || '');

    if (!verificationLink) {
      return res.status(200).json({ status: false, found: false, message: 'Menunggu link verifikasi masuk...' });
    }

    return res.status(200).json({
      status: true,
      found: true,
      email: email,
      verificationLink: verificationLink.replace(/&amp;/g, '&'),
      proStatus: 'PRO_TRIAL_ACTIVE',
      message: 'Link Verifikasi Ditemukan!'
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message || 'Gagal mengecek inbox' });
  }
};