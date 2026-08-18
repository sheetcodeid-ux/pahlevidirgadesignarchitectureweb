# Pahlevi Dirga — Website Studio Arsitektur

Monorepo untuk website studio: portfolio statis di edge, API Go untuk hal-hal
yang perlu rahasia, dan Supabase sebagai sumber data.

## Arsitektur

```
Pengunjung
    │
    ▼
Cloudflare Pages ──── HTML/CSS statis (Astro, di-build saat deploy)
    │                 gambar ← Cloudflare R2 (custom domain, egress gratis)
    │
    │ hanya untuk form kontak & panel admin
    ▼
Cloud Run ─────────── API Go Fiber (scale-to-zero)
    │                 ├─ verifikasi Turnstile + rate limit
    │                 ├─ presigned upload URL ke R2
    │                 └─ notifikasi email via Resend
    ▼
Supabase Postgres ─── data proyek + inquiry, dilindungi RLS
```

Pembagian tugasnya disengaja: halaman proyek dibangun saat deploy sehingga
pengunjung tidak pernah menunggu backend, dan Cloud Run hanya bangun saat ada
yang mengisi form atau saat admin mengunggah gambar. Itu yang menjaga seluruh
stack tetap di dalam free tier.

## Struktur

```
apps/
  api/                  Backend Go (Fiber)
    cmd/server/         Entrypoint
    internal/config/    Pemuatan environment
    internal/handler/   HTTP handler + validasi
    internal/middleware/  Auth JWT Supabase, error handler
    internal/repository/  Query Postgres (pgx)
    internal/storage/   Presigned upload R2
    internal/mailer/    Notifikasi Resend
  web/                  Frontend Astro (static)
    src/lib/api.ts      Klien API bertipe
    src/pages/          Beranda, arsip proyek, detail, kontak
supabase/
  migrations/           Skema + RLS
  seed.sql              Data contoh untuk development
.github/workflows/      CI, deploy API, backup harian
docs/                   Panduan setup & deployment
```

## Menjalankan secara lokal

Prasyarat: Go 1.24+, Node 22+, Supabase CLI.

```bash
# 1. Database lokal
supabase start
supabase db reset          # jalankan migrasi + seed

# 2. Backend
cp .env.example apps/api/.env   # isi DATABASE_URL & SUPABASE_JWT_SECRET
cd apps/api && make run         # http://localhost:8080

# 3. Frontend
cd apps/web
echo "PUBLIC_API_BASE_URL=http://localhost:8080" > .env
npm install && npm run dev      # http://localhost:4321
```

Cek cepat: `curl localhost:8080/healthz`.

## Perintah

| Perintah | Kegunaan |
| --- | --- |
| `cd apps/api && make test` | Test Go dengan race detector |
| `cd apps/api && make lint` | `go vet` + cek format |
| `cd apps/web && npm run check` | Typecheck Astro/TypeScript |
| `cd apps/web && npm run build` | Build statis ke `dist/` |
| `supabase db push` | Terapkan migrasi ke project remote |

## Endpoint API

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/healthz` | publik |
| GET | `/api/v1/projects` | publik, mendukung `?category=&featured=&limit=&offset=` |
| GET | `/api/v1/projects/:slug` | publik |
| POST | `/api/v1/inquiries` | publik, 5 request/IP/jam + Turnstile |
| GET | `/api/v1/admin/me` | perlu JWT Supabase |
| POST | `/api/v1/admin/uploads` | perlu JWT Supabase |

## Dokumentasi

- [`docs/layanan.md`](docs/layanan.md) — daftar akun/layanan yang perlu disiapkan
- [`docs/deployment.md`](docs/deployment.md) — langkah deploy ke production
