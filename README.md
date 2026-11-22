# Noxis React Ch (GitHub + Vercel)

Struktur proyek siap deploy ke GitHub dan Vercel:
- `api/react.ts` — Serverless function handler (`POST /api/react`) dengan validasi input, batasan maksimal 5 emoji, cookie session capture, serta perbaikan deteksi endpoint dan status respons.
- `api/docs.ts` — Endpoint dokumentasi ringan (`GET /api/docs`).
- `public/index.html` — Antarmuka web dengan penanganan respons non-JSON/error HTTP yang aman serta tombol akses saluran.
- `vercel.json` — Konfigurasi rewrite untuk `/api/react`, `/api/docs`, dan SPA fallback ke `/public/index.html`.
