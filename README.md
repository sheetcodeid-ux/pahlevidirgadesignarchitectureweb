# Pahlevi Dirga — Website Studio Arsitektur

Monorepo untuk website studio: portfolio statis di edge, API di Cloudflare
Workers untuk hal-hal yang perlu rahasia, dan Supabase sebagai sumber data.

## Stack

| Lapisan | Dipakai | Region | Biaya |
| --- | --- | --- | --- |
| Frontend | Cloudflare Workers (Static Assets) | edge global | gratis |
| Gambar | Cloudflare R2 | edge global | gratis (10 GB, tanpa egress) |
| API | Hono di Cloudflare Workers, Postgres lewat Hyperdrive | edge global | gratis (free tier Workers) |
| Database & Auth | Supabase | `ap-southeast-1` | gratis |
| Email | Resend | — | gratis (3.000/bulan) |
| Anti-bot | Cloudflare Turnstile | — | gratis |

Frontend dan API sama-sama Cloudflare Workers — dua Worker terpisah
(`pahlevidirgadesignarchitectureweb` dan `pahlevidirga-api`), bukan satu
Worker yang menangani keduanya, supaya bisa di-deploy dan diberi rahasia
secara independen.

## Arsitektur

```
Pengunjung
    │
    ▼
Cloudflare Workers ── HTML/CSS statis (Astro, di-build saat deploy)
    │                 gambar ← Cloudflare R2 (custom domain, egress gratis)
    │
    │ hanya untuk form kontak & panel admin
    ▼
Cloudflare Workers ── API (Hono)
    │                 ├─ verifikasi Turnstile + rate limit (KV)
    │                 ├─ presigned upload URL ke R2
    │                 └─ notifikasi email via Resend
    ▼
Hyperdrive ─────────── pooling koneksi ke Supabase Postgres
    ▼
Supabase Postgres ─── data proyek + inquiry, dilindungi RLS
```

Pembagian tugasnya disengaja: halaman proyek dibangun saat deploy sehingga
pengunjung tidak pernah menunggu backend, dan Worker API hanya bekerja saat
ada yang mengisi form atau saat admin mengunggah gambar. Itu yang menjaga
seluruh stack tetap di dalam free tier.

## Struktur

```
apps/
  api/                  Backend Hono (Cloudflare Workers)
    src/index.ts         Wiring app, CORS, error handler
    src/routes/          Handler HTTP per area (projects, auth, inquiries, admin)
    src/middleware/       Auth JWT Supabase, status staf, rate limit (KV)
    src/repository/       Query Postgres lewat Hyperdrive (postgres.js)
    src/lib/              Turnstile, mailer Resend, presign R2, validasi
  web/                  Frontend Astro (static)
    src/lib/api.ts      Klien API publik
    src/lib/admin.ts    Klien API admin + penyegaran token
    src/pages/          Beranda, arsip proyek, detail, kontak
    src/pages/admin/    Panel admin: masuk, dashboard, proyek, pesan
supabase/
  migrations/           Skema + RLS
  bootstrap.sql         Seluruh skema dalam satu file, untuk SQL Editor
  tests/rls_test.sql    Assertion RLS (transaksi, di-rollback)
  seed.sql              Data contoh untuk development
.github/workflows/      CI, deploy API, backup harian
docs/                   Panduan setup & deployment
scripts/                Skrip provisioning satu-perintah per fase
```

## Menjalankan secara lokal

Prasyarat: Node 22+, Supabase CLI.

```bash
# 1. Database lokal
supabase start
supabase db reset          # jalankan migrasi + seed

# 2. Backend
cd apps/api
npm install
cp .dev.vars.example .dev.vars   # isi SUPABASE_SERVICE_ROLE_KEY dkk.
npm run dev                      # http://localhost:8787

# 3. Frontend
cd apps/web
echo "PUBLIC_API_BASE_URL=http://localhost:8787" > .env
npm install && npm run dev       # http://localhost:4321
```

Cek cepat: `curl localhost:8787/healthz`.

## Perintah

| Perintah | Kegunaan |
| --- | --- |
| `cd apps/api && npm test` | Test API (vitest) |
| `cd apps/api && npm run typecheck` | Typecheck API |
| `cd apps/api && npx wrangler deploy --dry-run` | Periksa bundling & binding tanpa deploy |
| `cd apps/web && npm run check` | Typecheck Astro/TypeScript |
| `cd apps/web && npm run build` | Build statis ke `dist/` |
| `supabase db push` | Terapkan migrasi ke project remote |
| `./scripts/build-bootstrap.sh` | Regenerate `supabase/bootstrap.sql` dari migrasi |
| `./scripts/verify-supabase.sh "$SUPABASE_DIRECT_URL"` | Periksa skema, RLS, GRANT, dan akun staf |
| `psql "$DATABASE_URL" -f supabase/tests/rls_test.sql` | Uji policy RLS dan GRANT |
| `./scripts/setup-fase-04.sh` | Provisioning Hyperdrive + rahasia Worker API, lalu deploy |

## Endpoint API

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/healthz` | publik |
| GET | `/api/v1/projects` | publik, mendukung `?category=&featured=&limit=&offset=` |
| GET | `/api/v1/projects/:slug` | publik |
| POST | `/api/v1/inquiries` | publik, 5 request/IP/jam (KV) + Turnstile |
| POST | `/api/v1/auth/login` | publik, 10 percobaan/IP/jam (KV) |
| POST | `/api/v1/auth/refresh` | publik, butuh refresh token |
| GET | `/api/v1/admin/me` | JWT Supabase **dan** terdaftar di `profiles` |
| POST | `/api/v1/admin/uploads` | idem |
| GET/POST | `/api/v1/admin/projects` | idem |
| PATCH/DELETE | `/api/v1/admin/projects/:id` | idem |
| POST | `/api/v1/admin/projects/:id/images` | idem |
| DELETE | `/api/v1/admin/images/:imageId` | idem |
| GET | `/api/v1/admin/inquiries` | idem |
| PATCH | `/api/v1/admin/inquiries/:id` | idem |

## Dokumentasi

- [`docs/setup-supabase.md`](docs/setup-supabase.md) — panduan menyiapkan database, langkah demi langkah
- [`docs/layanan.md`](docs/layanan.md) — daftar akun/layanan yang perlu disiapkan
- [`docs/deployment.md`](docs/deployment.md) — langkah deploy ke production
