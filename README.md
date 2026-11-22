# Noxis — Bypass Link (v1.2.0)

Perbaikan pada v1.2.0:
- Memblokir domain iklan/pop-under/smartlink (seperti `honmia.com` dan pola `/4/<hash>`) agar tidak pernah dijadikan hasil link tujuan ketika memproses `bicolink.com`.
- Menghapus scan URL acak di body HTML yang rawan menyambar link iklan saat link tujuan aslinya belum terbuka.
