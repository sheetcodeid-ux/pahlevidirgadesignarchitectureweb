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
2. Pada bucket media: Settings → Custom Domain → `media.pahlevidirga.com`
3. R2 → Manage API Tokens → buat token Object Read & Write

Aktifkan juga cache rule agar gambar disimpan lama di edge:
Caching → Cache Rules, hostname `media.pahlevidirga.com`, Edge TTL 1 tahun.
Nama file mengandung suffix acak, jadi versi baru tidak akan tertahan cache.

## 3. Cloud Run

Simpan rahasia di Secret Manager — nama-nama ini dirujuk oleh workflow deploy:

```bash
for name in database-url supabase-jwt-secret supabase-service-role-key \
            r2-access-key-id r2-secret-access-key turnstile-secret \
            resend-api-key ip-hash-salt; do
  printf '%s' "<nilai>" | gcloud secrets create "$name" --data-file=-
done
```

Beri service account Cloud Run izin `roles/secretmanager.secretAccessor`.

Untuk deploy dari GitHub Actions tanpa menyimpan key JSON, siapkan Workload
Identity Federation, lalu isi di repo:

| Tipe | Nama | Isi |
| --- | --- | --- |
| Secret | `GCP_WORKLOAD_IDENTITY_PROVIDER` | resource name provider |
| Secret | `GCP_SERVICE_ACCOUNT` | email service account deployer |
| Variable | `ALLOWED_ORIGINS` | `https://pahlevidirga.com` |
| Variable | `R2_PUBLIC_BASE_URL` | `https://media.pahlevidirga.com` |
| Variable | `R2_BUCKET`, `R2_ACCOUNT_ID` | dari langkah 2 |
| Variable | `INQUIRY_NOTIFY_TO`, `INQUIRY_FROM` | alamat email studio |

Push ke `main` yang menyentuh `apps/api/**` akan men-deploy otomatis.

Terakhir, arahkan `api.pahlevidirga.com` ke URL Cloud Run lewat CNAME
ter-proxy (awan oranye) supaya WAF dan rate limiting Cloudflare ikut aktif.

## 4. Cloudflare Pages

Sambungkan repo lewat Workers & Pages → Create → Pages → Connect to Git.

| Setelan | Nilai |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `apps/web` |

Environment variable produksi:

```
PUBLIC_API_BASE_URL=https://api.pahlevidirga.com
PUBLIC_SITE_URL=https://pahlevidirga.com
PUBLIC_TURNSTILE_SITE_KEY=<site key>
```

Halaman proyek dibangun saat deploy, jadi **konten baru belum muncul sampai
ada build ulang**. Buat Deploy Hook di Pages, lalu panggil URL-nya setiap kali
konten berubah — dari panel admin nanti, atau manual untuk sekarang.

## 5. Setelah tayang

- Kirim satu pesan uji lewat `/kontak`, pastikan email notifikasi masuk
- Jalankan workflow **Backup database** secara manual sekali untuk memastikan
  kredensialnya benar, jangan tunggu insiden untuk mengetahuinya
- Daftarkan `https://pahlevidirga.com/sitemap-index.xml` di Google Search Console
- Aktifkan Cloudflare Web Analytics untuk domain
