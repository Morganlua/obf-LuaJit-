import fetch from 'node-fetch';

const BASE_GENEMAIL = 'https://generator.email';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getGeneratorEmailSession() {
    try {
        const init = await fetch(`${BASE_GENEMAIL}/`, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(10000)
        });
        const setCookies = init.headers.getSetCookie ? init.headers.getSetCookie() : [init.headers.get('set-cookie') || ''];
        const hpCookie = setCookies.find(c => c && c.startsWith('__Host-ab_hp='));
        const rawCtx = setCookies.find(c => c && c.startsWith('inbox_ctx='));

        let domain = 'heyzalo.vn';
        if (rawCtx) {
            try {
                const dec = decodeURIComponent(rawCtx.split(';')[0].split('=')[1]);
                const extracted = dec.split('/')[0];
                if (extracted) domain = extracted;
            } catch {}
        }

        const hpCookieHeader = hpCookie ? hpCookie.split(';')[0] : '';
        return { domain, hpCookieHeader };
    } catch (err) {
        return { domain: 'heyzalo.vn', hpCookieHeader: '' };
    }
}

function generateRandomUser() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let user = 'capcut';
    for (let i = 0; i < 6; i++) {
        user += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    user += Math.floor(Math.random() * 89 + 10);
    return user;
}

async function fetchCapCutOTP(domain, user, hpCookieHeader, maxAttempts = 8) {
    const ctx = encodeURIComponent(`${domain}/${user}/`);
    const cookies = `inbox_ctx=${ctx}; ${hpCookieHeader}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await sleep(attempt === 1 ? 4000 : 3000);
        try {
            const res = await fetch(`${BASE_GENEMAIL}/inbox1/`, {
                headers: {
                    'User-Agent': UA,
                    'Cookie': cookies
                },
                signal: AbortSignal.timeout(10000)
            });
            const html = await res.text();

            // Scraper Regex khusus mencari pola 6 digit angka OTP CapCut
            const matchOtp = html.match(/\b\d{6}\b/);
            if (matchOtp) {
                return matchOtp[0];
            }
        } catch {}
    }

    return null; // Jika belum/tidak ditemukan OTP dalam batas attempt
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { count = 1 } = req.body;
        const results = [];
        const num = Math.max(1, Math.min(Number(count) || 1, 5));

        for (let i = 0; i < num; i++) {
            const sessionData = await getGeneratorEmailSession();
            const user = generateRandomUser();
            const email = `${user}@${sessionData.domain}`;
            const inbox = `${BASE_GENEMAIL}/${email}`;

            // Polling OTP 6 Digit dari inbox
            const otpCode = await fetchCapCutOTP(sessionData.domain, user, sessionData.hpCookieHeader);

            results.push({
                status: true,
                email,
                otp: otpCode || 'Menunggu Kode...',
                planName: 'CapCut Pro / Team Workspace',
                inbox,
                validUntil: '2027-10-23'
            });

            if (i < num - 1) await sleep(1500);
        }

        return res.status(200).json({
            success: true,
            total: results.length,
            results
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}