# Layanan yang dipakai

Keadaan layanan di luar kode: mana yang sudah terpasang dan berjalan, mana
yang masih menganggur. Situsnya sendiri **sudah tayang** — dokumen ini bukan
lagi daftar syarat peluncuran, melainkan catatan apa yang hidup dan apa yang
belum.

Yang belum beres sekarang hampir semuanya **isi**, bukan layanan. Lihat
bagian terakhir.

## Sudah terpasang dan berjalan

| Layanan | Dipakai untuk | Bukti masih hidup |
| --- | --- | --- |
| Supabase (Free) | Postgres + Auth panel admin | Migrasi diterapkan otomatis lewat integrasi GitHub |
| GitHub Actions | CI dan deploy kedua Worker | Tab Actions, workflow `deploy.yml` |
| Cloudflare Workers | Situs statis + Worker API | Stempel `modified_on` kedua Worker |
| Cloudflare R2 | `pahlevidirga-media` untuk gambar proyek dan logo studio | Custom domain `media.pahlevidirgaarchitecture.com` |
| Cloudflare R2 | `pahlevidirga-backup` untuk dump database harian | Workflow `backup-db.yml`, jadwal 02:00 WIB |
| Cloudflare Turnstile | Anti-bot form kontak | Widget "Form kontak pahlevidirga" |
| Domain | `pahlevidirgaarchitecture.com` beserta `api.` dan `media.` | Ketiganya resolve |

### Backup — jangan dianggap remeh

Supabase Free **tidak** punya backup otomatis maupun PITR. `backup-db.yml`
adalah satu-satunya jaring pengaman kalau data terhapus. Sempat gagal tiga
kali pada 25 Agustus sebelum akhirnya hijau — jadi kalau ada perubahan pada
kredensial database, periksa workflow ini, jangan berasumsi masih jalan.

Yang belum pernah diuji: **memulihkan** dari dump itu. Punya backup yang tidak
pernah dicoba dipulihkan sama saja dengan tidak punya backup.

## Terpasang tapi perlu dipastikan

### Resend — notifikasi email form kontak

Kodenya sudah ada (`apps/api/src/lib/mailer.ts`). Email hanya terkirim kalau
**dua** rahasia Worker terisi: `RESEND_API_KEY` dan `INQUIRY_NOTIFY_TO`. Kalau
salah satu kosong, pesan tetap tersimpan ke database tapi tidak ada
pemberitahuan yang masuk — dan tidak ada tanda apa pun bahwa itu terjadi.

Cara memastikan: kirim satu pesan uji dari `/kontak`, lalu lihat apakah
emailnya masuk. Kalau tidak, setel rahasianya dengan `wrangler secret put`.

Domain pengirim perlu record SPF, DKIM, dan DMARC di Cloudflare DNS.

## Belum dipasang — semuanya opsional

| Layanan | Gunanya | Kenapa belum mendesak |
| --- | --- | --- |
| Cloudflare Email Routing | `studio@pahlevidirgaarchitecture.com` diteruskan ke Gmail, tanpa langganan Google Workspace | Email studio masih pakai Gmail biasa dan itu berfungsi |
| Sentry | Melihat error Worker API tanpa harus membuka Workers Logs | Lalu lintasnya masih sangat kecil; error masih bisa ditemukan manual |
| Cloudflare Web Analytics | Statistik pengunjung tanpa cookie, jadi tidak butuh cookie banner | Belum ada pengunjung yang perlu dihitung sampai proyeknya terisi |
| Cloudflare Access di depan `/admin/*` | Memindahkan penjagaan panel admin ke edge | **Data**-nya sudah aman — API menolak yang bukan staf di sisi server. Yang terbuka hanya kerangka halamannya, karena situsnya statis |

## Yang sebenarnya menghambat sekarang: isi, bukan layanan

Tidak ada satu pun layanan yang menghalangi. Yang menahan adalah ini:

- **Foto proyek.** Belum ada satu pun gambar galeri di database. Website
  arsitektur berdiri atau jatuh di sini. Siapkan 5–8 foto per proyek, sisi
  terpanjang 2400px, unggah lewat panel admin.
- **Deskripsi proyek.** Satu-satunya proyek yang tayang (`rumah-kaca`) masih
  berisi teks percobaan sepanjang sepuluh huruf. `/tentang` sudah berisi
  profil studio sungguhan; yang kosong justru proyeknya.
- **Halaman kebijakan privasi.** Form kontak mengumpulkan nama, email, dan
  nomor telepon, jadi halaman ini perlu ada dan ditautkan dari footer.
- **Testimoni.** Belum ada satu pun. Seksinya di beranda sengaja tidak tampil
  saat kosong, jadi tidak ada yang rusak — tapi bagian itu memang belum
  pernah terlihat sungguhan.
