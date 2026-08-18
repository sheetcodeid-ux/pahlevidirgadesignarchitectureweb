# Layanan yang perlu disiapkan

Ringkasan apa yang sudah ada dan apa yang masih kurang sebelum website bisa
tayang. Semua yang ditandai **wajib** harus beres; sisanya bisa menyusul.

## Sudah ada

| Layanan | Dipakai untuk |
| --- | --- |
| Supabase (free) | Postgres, Auth untuk panel admin |
| GitHub | Repositori + CI/CD lewat Actions |
| Cloudflare (free) | DNS, Pages, R2, Turnstile, analytics |

## Masih kurang

### 1. Domain — **wajib**

Belum ada di daftar. Beli lalu arahkan nameserver ke Cloudflare, atau langsung
beli di Cloudflare Registrar (dijual at-cost, tanpa markup perpanjangan).

Subdomain yang akan dipakai:

| Host | Menunjuk ke |
| --- | --- |
| `pahlevidirga.com` | Cloudflare Pages |
| `api.pahlevidirga.com` | Cloud Run (lewat proxy Cloudflare) |
| `media.pahlevidirga.com` | bucket R2 |

### 2. Google Cloud — **wajib**

Untuk menjalankan API Go di Cloud Run. Free tier permanen (2 juta request,
180.000 vCPU-detik/bulan) jauh di atas kebutuhan website portfolio, tapi akun
tetap minta kartu kredit untuk aktivasi.

Agar dipastikan tidak ada tagihan:

- `--max-instances 3` sudah disetel di workflow deploy
- pasang budget alert di angka kecil (mis. $1) lewat Billing → Budgets
- pakai region `us-central1`; free tier tidak berlaku di region Jakarta

### 3. Cloudflare R2 — **wajib**

Bucket untuk foto proyek. 10 GB penyimpanan gratis dan **egress gratis** —
inilah alasan gambar tidak ditaruh di Supabase Storage, yang free tier-nya
hanya 1 GB dengan egress 5 GB/bulan.

Perlu diperhatikan: R2 minta metode pembayaran terpasang di akun Cloudflare
sebelum bucket bisa dibuat, walaupun pemakaiannya di bawah kuota gratis.

Yang perlu dibuat:

- bucket `pahlevidirga-media`, sambungkan custom domain `media.pahlevidirga.com`
- bucket `pahlevidirga-backup` untuk dump database harian
- API token R2 dengan izin Object Read & Write

### 4. Cloudflare Turnstile — **wajib**

Gratis, tanpa kartu. Buat satu widget, ambil site key (untuk frontend) dan
secret key (untuk backend). Tanpa ini form kontak akan dibanjiri spam bot
dalam hitungan hari setelah domain terindeks.

### 5. Resend — **wajib**

Notifikasi email saat ada calon klien mengisi form. Free tier 3.000
email/bulan. Perlu verifikasi domain pengirim dengan menambahkan record SPF,
DKIM, dan DMARC di Cloudflare DNS.

Alasan tidak memakai SMTP bawaan Supabase: layanan itu hanya untuk email auth
dan rate limit-nya sangat ketat.

### 6. Cloudflare Email Routing — disarankan

Gratis, dan membuat `studio@pahlevidirga.com` diteruskan ke Gmail tanpa perlu
berlangganan Google Workspace.

### 7. Sentry — disarankan

Error tracking untuk backend Go. Free tier 5.000 error/bulan. Tanpa ini,
kegagalan hanya terlihat kalau kamu sedang membuka Cloud Logging.

### 8. Cloudflare Web Analytics — disarankan

Gratis, tanpa cookie, jadi tidak butuh cookie banner. Cukup aktifkan untuk
domain di dashboard Cloudflare.

## Bukan layanan, tapi tetap penghambat

Ini yang biasanya membuat peluncuran mundur, bukan urusan teknisnya:

- **Foto proyek resolusi tinggi.** Website arsitektur berdiri atau jatuh di
  sini. Siapkan minimal 5–8 foto per proyek, sisi terpanjang 2400px.
- **Teks profil studio dan deskripsi tiap proyek.** Halaman `/tentang` saat ini
  masih berisi teks placeholder.
- **Panel admin.** Belum dibuat. API-nya sudah siap
  (`/api/v1/admin/uploads`), tapi antarmuka untuk staf mengunggah proyek
  belum ada. Sementara ini konten bisa diisi lewat Supabase Studio.
- **Halaman kebijakan privasi.** Form kontak mengumpulkan nama, email, dan
  nomor telepon, jadi halaman ini perlu ada.
