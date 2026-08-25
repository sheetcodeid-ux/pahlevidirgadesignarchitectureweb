# Deployment

Urutannya penting: database dulu, lalu penyimpanan, lalu backend, terakhir
frontend — tiap langkah menghasilkan nilai yang dibutuhkan langkah berikutnya.

## 1. Supabase

```bash
supabase link --project-ref <project-ref>
supabase db push          # menerapkan migrasi di supabase/migrations
```

Catat dari **Project Settings**:

| Nilai | Lokasi |
| --- | --- |
| Connection string pooler (port 6543) | Database → Connection pooling |
| Connection string langsung (port 5432) | Database → Connection string |
| JWT secret | API → JWT Settings |
| Service role key | API → Project API keys |

Backend memakai **pooler**; workflow backup memakai koneksi **langsung**
karena `pg_dump` butuh session penuh.

Buat akun staf lewat **Authentication → Users → Invite**, lalu daftarkan ke
tabel `profiles` supaya lolos RLS:

```sql
insert into public.profiles (id, full_name, role)
values ('<uuid-user>', 'Nama Staf', 'admin');
```

> Free tier akan mem-pause project setelah 7 hari tanpa aktivitas. Backup
> harian di `.github/workflows/backup-db.yml` sekaligus mencegah ini, karena
> koneksinya menghitung sebagai aktivitas.

## 2. Cloudflare R2

1. R2 → Create bucket: `pahlevidirga-media` dan `pahlevidirga-backup`
2. Pada bucket media: Settings → Custom Domain → `media.pahlevidirgaarchitecture.com`
3. R2 → Manage API Tokens → buat token Object Read & Write

Setelah token dibuat, isi lewat `wrangler secret put` (langkah 3) lalu coba
endpoint `/api/v1/admin/uploads` langsung — presigned URL yang dikembalikan
itu jalur yang dipakai panel admin, browser mengunggah langsung ke R2 tanpa
melewati Worker API.

Aktifkan juga cache rule agar gambar disimpan lama di edge:
Caching → Cache Rules, hostname `media.pahlevidirgaarchitecture.com`, Edge TTL 1 tahun.
Nama file mengandung suffix acak, jadi versi baru tidak akan tertahan cache.

## 3. API (Cloudflare Workers)

Worker `pahlevidirga-api`, terpisah dari Worker situs statis. Berjalan di
edge Cloudflare — tidak terikat satu region seperti Cloud Run dulu.

Langkah di bawah ini (Hyperdrive, rahasia lewat `wrangler secret`) bisa
dikerjakan sekaligus lewat `./scripts/setup-fase-04.sh` — jalankan dari
mesin sendiri yang sudah login `npx wrangler login`, bukan dari sesi Claude
Code (tidak ada kredensial wrangler di sana). Aman dijalankan berulang.

Ringkasannya:

1. **Hyperdrive** dibuat menunjuk ke session pooler Supabase (port 5432,
   bukan transaction pooler 6543 — Hyperdrive sudah jadi pooler-nya sendiri):
   ```bash
   cd apps/api
   npx wrangler hyperdrive create pahlevidirga-db \
     --connection-string="postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```
   ID yang dikembalikan diisi ke `apps/api/wrangler.jsonc` bagian `hyperdrive[0].id`.

2. **Rahasia** disetel satu per satu, tidak pernah lewat `wrangler.jsonc`:
   ```bash
   printf '%s' "<nilai>" | npx wrangler secret put SUPABASE_JWT_SECRET
   ```
   Nama-nama yang dibutuhkan: `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_ANON_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `INQUIRY_NOTIFY_TO`,
   `IP_HASH_SALT`. Nilai yang bukan rahasia (`SUPABASE_URL`, `R2_ACCOUNT_ID`,
   `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `ALLOWED_ORIGINS`) sudah ada di
   `wrangler.jsonc` bagian `vars`.

3. **Deploy manual** untuk verifikasi pertama kali:
   ```bash
   npx wrangler deploy
   curl https://pahlevidirga-api.<subdomain-akun>.workers.dev/healthz
   ```

4. **Deploy otomatis dari GitHub Actions** butuh dua secret di repo:

   | Secret | Isi |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | token dengan izin Edit Workers (dashboard → My Profile → API Tokens) |
   | `CLOUDFLARE_ACCOUNT_ID` | `cf6a6bde45d3fd8a93463e6cc7e71aa1` |

   Push ke `main` yang menyentuh `apps/api/**` akan men-deploy otomatis
   lewat `.github/workflows/deploy-api.yml`.

Terakhir, arahkan `api.pahlevidirgaarchitecture.com` ke Worker ini lewat **Custom
Domains** di dashboard Worker (bukan CNAME manual) — Cloudflare yang
mengurus sertifikat dan routing-nya.

## 4. Cloudflare Workers (situs statis)

Situs disajikan Workers Static Assets, bukan Pages. Worker
`pahlevidirgadesignarchitectureweb` sudah tersambung ke repo ini; yang
dibutuhkan hanya setelan build yang benar.

`wrangler.jsonc` di akar repo sudah mengatur sisanya — nama Worker, direktori
aset (`apps/web/dist`), dan penanganan 404. **Tidak ada `main`**, jadi tidak ada
kode Worker yang berjalan: murni berkas statis dari edge.

Di **Settings → Build**:

| Setelan | Nilai |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

Build command wajib diisi. Workers Builds **tidak** membaca blok `build` di
wrangler.jsonc — itu hanya berlaku untuk `wrangler dev` lokal — jadi tanpa
setelan ini `dist` tidak pernah dibuat dan deploy gagal dengan
"Could not detect a directory containing static files".

Build variables:

```
PUBLIC_API_BASE_URL=https://api.pahlevidirgaarchitecture.com
PUBLIC_SITE_URL=https://pahlevidirgaarchitecture.com
PUBLIC_TURNSTILE_SITE_KEY=<site key>
```

Tanpa `PUBLIC_API_BASE_URL`, situs yang tayang akan menunjuk
`http://localhost:8787` — halaman tetap tampil, tapi form kontak dan panel
admin tidak akan berfungsi bagi pengunjung.

Halaman proyek dibangun saat deploy, jadi **konten baru belum muncul sampai
ada build ulang**. Buat Deploy Hook di Pages, lalu panggil URL-nya setiap kali
konten berubah — dari panel admin nanti, atau manual untuk sekarang.

## 5. Setelah tayang

- Kirim satu pesan uji lewat `/kontak`, pastikan email notifikasi masuk
- Jalankan workflow **Backup database** secara manual sekali untuk memastikan
  kredensialnya benar, jangan tunggu insiden untuk mengetahuinya
- Daftarkan `https://pahlevidirgaarchitecture.com/sitemap-index.xml` di Google Search Console
- Aktifkan Cloudflare Web Analytics untuk domain
