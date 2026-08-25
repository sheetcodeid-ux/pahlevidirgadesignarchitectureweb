# Layanan yang perlu disiapkan

Ringkasan apa yang sudah ada dan apa yang masih kurang sebelum website bisa
tayang. Semua yang ditandai **wajib** harus beres; sisanya bisa menyusul.

## Sudah ada

| Layanan | Dipakai untuk |
| --- | --- |
| Supabase (free) | Postgres, Auth untuk panel admin |
| GitHub | Repositori + CI/CD lewat Actions |
| Cloudflare (free) | DNS, Workers (situs statis + API), R2, Turnstile, analytics |

## Masih kurang

### 1. Domain — **wajib**

Belum ada di daftar. Beli lalu arahkan nameserver ke Cloudflare, atau langsung
beli di Cloudflare Registrar (dijual at-cost, tanpa markup perpanjangan).

Subdomain yang akan dipakai:

| Host | Menunjuk ke |
| --- | --- |
| `pahlevidirgaarchitecture.com` | Worker situs statis (`pahlevidirgadesignarchitectureweb`) |
| `api.pahlevidirgaarchitecture.com` | Worker API (`pahlevidirga-api`), lewat Custom Domains |
| `media.pahlevidirgaarchitecture.com` | bucket R2 |

Tidak ada akun Google Cloud yang perlu disiapkan — API sekarang jalan di
Cloudflare Workers yang sama dengan situs statis, bukan Cloud Run. Satu
platform lebih sedikit untuk dikelola.

### 2. Cloudflare R2 — **wajib**

Bucket untuk foto proyek. 10 GB penyimpanan gratis dan **egress gratis** —
inilah alasan gambar tidak ditaruh di Supabase Storage, yang free tier-nya
hanya 1 GB dengan egress 5 GB/bulan.

Perlu diperhatikan: R2 minta metode pembayaran terpasang di akun Cloudflare
sebelum bucket bisa dibuat, walaupun pemakaiannya di bawah kuota gratis.

Yang perlu dibuat:

- bucket `pahlevidirga-media`, sambungkan custom domain `media.pahlevidirgaarchitecture.com`
- bucket `pahlevidirga-backup` untuk dump database harian
- API token R2 dengan izin Object Read & Write

### 3. Cloudflare Turnstile — **wajib**

Gratis, tanpa kartu. Buat satu widget, ambil site key (untuk frontend) dan
secret key (untuk backend). Tanpa ini form kontak akan dibanjiri spam bot
dalam hitungan hari setelah domain terindeks.

### 4. Resend — **wajib**

Notifikasi email saat ada calon klien mengisi form. Free tier 3.000
email/bulan. Perlu verifikasi domain pengirim dengan menambahkan record SPF,
DKIM, dan DMARC di Cloudflare DNS.

Alasan tidak memakai SMTP bawaan Supabase: layanan itu hanya untuk email auth
dan rate limit-nya sangat ketat.

### 5. Cloudflare Email Routing — disarankan

Gratis, dan membuat `studio@pahlevidirgaarchitecture.com` diteruskan ke Gmail tanpa perlu
berlangganan Google Workspace.

### 6. Sentry — disarankan

Error tracking untuk Worker API. Free tier 5.000 error/bulan. Tanpa ini,
kegagalan hanya terlihat kalau kamu sedang membuka Cloudflare Workers Logs.

### 7. Cloudflare Web Analytics — disarankan

Gratis, tanpa cookie, jadi tidak butuh cookie banner. Cukup aktifkan untuk
domain di dashboard Cloudflare.

## Bukan layanan, tapi tetap penghambat

Ini yang biasanya membuat peluncuran mundur, bukan urusan teknisnya:

- **Foto proyek resolusi tinggi.** Website arsitektur berdiri atau jatuh di
  sini. Siapkan minimal 5–8 foto per proyek, sisi terpanjang 2400px — belum
  ada satu proyek pun yang dipublikasikan.
- **Deskripsi tiap proyek.** Halaman `/tentang` sudah berisi profil studio
  sungguhan; yang masih kosong adalah data proyek itu sendiri.
- **Halaman kebijakan privasi.** Form kontak mengumpulkan nama, email, dan
  nomor telepon, jadi halaman ini perlu ada.
