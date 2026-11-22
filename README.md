# Noxis — Bypass Link (Vercel)

Struktur proyek siap deploy ke Vercel:
- `api/index.js` — Router utama bypass link (`mgvt`, `umpc`, `lv`, `social`).
- `api/umpc.js` — Perbaikan handler Bicolink (`bicolink.com` & domain mirror/terkait) dengan pelacakan redirect, ekstraksi URL/base64/query, dan fallback endpoint.
- `api/social.js` — Perbaikan handler Social Unlock dengan normalisasi cookie per host, validasi URL target eksternal, dan pembersihan entity HTML.
- `api/mgvt.js` & `api/lv.js` — Engine SafelinkU dan Linkvertise.
- `public/index.html` — Antarmuka gelap monokrom bergaya panel neo-brutalist/terminal sesuai referensi.
