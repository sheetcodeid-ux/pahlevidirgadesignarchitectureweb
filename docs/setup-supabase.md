# Setup Supabase

Menyiapkan database `pahlevidirga-web` sampai siap dipakai backend Go.
Sekitar 10 menit.

Versi web panduan ini: https://claude.ai/code/artifact/d975c708-cac7-4c4d-acfa-fae304f1e017

## Status: project sudah dibuat

| | |
| --- | --- |
| Organisasi | `pahlevidirgadesignarchitecture` — plan **Free**, $0/bulan |
| Project | `pahlevidirga-web` |
| Region | AWS `ap-southeast-1` (Singapore) |
| Compute | Nano |
| Integrasi GitHub | Aktif, tersambung ke repo ini |

Sisa langkahnya lima, di bawah. Inti pekerjaannya ada di **langkah 2**:
satu kali tempel ke SQL Editor, tanpa memasang CLI apa pun.

> **Integrasi GitHub aktif.** Supabase akan menerapkan isi `supabase/migrations/`
> secara otomatis begitu branch produksi (`main`) berubah. Karena migrasi kita
> masih di branch `claude/stack-setup-…`, sekarang belum ada yang ia kerjakan.
> `bootstrap.sql` di langkah 2 sudah mencatatkan kedua migrasi ke
> `supabase_migrations.schema_migrations`, jadi setelah nanti di-merge ke `main`
> integrasi itu akan melihatnya sebagai sudah terpasang dan melewatinya —
> bukan menerapkannya dua kali.

## 1. Salin empat kredensial

Semua ada di **Project Settings**.

| Nilai | Lokasi | Dipakai sebagai |
| --- | --- | --- |
| Connection string — Session pooler (5432) | Database → Connection pooling | dipakai `wrangler hyperdrive create` untuk Worker API |
| Connection string — Direct (5432) | Database → Connection string | `SUPABASE_DIRECT_URL` (backup & tes RLS) |
| service_role key | API → Project API keys | `SUPABASE_SERVICE_ROLE_KEY` |
| Project URL | API | `SUPABASE_URL` |

Tidak perlu JWT Secret — Worker API memverifikasi token login lewat JWKS
publik Supabase (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`), bukan
shared secret, jadi otomatis ikut kunci mana pun yang aktif (Supabase kini
memakai JWT Signing Keys ES256, bukan lagi JWT secret HS256).

> `service_role` melewati seluruh RLS. Kunci ini hanya boleh hidup di rahasia
> Worker API (`wrangler secret put`) atau `apps/api/.dev.vars` yang tidak
> pernah di-commit.

Worker API tidak menyimpan `DATABASE_URL` langsung — koneksinya lewat
**Hyperdrive**, yang diberi connection string **session pooler** (port 5432,
bukan transaction pooler 6543) saat dibuat lewat
`./scripts/setup-fase-04.sh`. Hyperdrive sudah jadi pooler-nya sendiri di
sisi Cloudflare, jadi tidak perlu pooler transaksi di atasnya. **Direct**
(juga 5432, tapi tanpa pooler sama sekali) dipakai terpisah untuk `pg_dump`
dan `psql` yang butuh session penuh.

## 2. Terapkan skema — sekali tempel

Buka **SQL Editor** di dashboard, tempel seluruh isi
[`supabase/bootstrap.sql`](../supabase/bootstrap.sql), lalu **Run**.

File itu berisi kedua migrasi sekaligus, dibungkus satu transaksi. Kalau ada
yang gagal, tidak ada yang setengah terpasang. Menjalankannya dua kali juga
aman — ia berhenti dengan pesan jelas alih-alih merusak skema yang sudah ada.

Yang terbentuk: tabel `projects`, `project_images`, `inquiries`, `profiles`,
beserta RLS, GRANT, dan catatan riwayat migrasi.

<details>
<summary>Alternatif: lewat Supabase CLI</summary>

```bash
git fetch origin
git checkout claude/stack-setup-supabase-cloudflare-kdwlkk
supabase link --project-ref <project-ref>
supabase db push
```

Pilih salah satu saja — jangan keduanya. `bootstrap.sql` sudah mengisi riwayat
migrasi, jadi `db push` setelahnya akan melaporkan tidak ada yang perlu
diterapkan.

</details>

`bootstrap.sql` dihasilkan dari file migrasi oleh
`scripts/build-bootstrap.sh`. Kalau migrasinya berubah, jalankan skrip itu lagi
— jangan menyunting `bootstrap.sql` langsung.

## 3. Verifikasi RLS sebelum percaya

```bash
psql "<direct connection string>" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
```

Yang benar: 11 baris `NOTICE: ok: …` dan nol `GAGAL`. Semuanya dibungkus
transaksi yang di-rollback, jadi aman dijalankan terhadap database berisi data.

| Peran | Harus bisa | Harus ditolak |
| --- | --- | --- |
| Pengunjung (`anon`) | Baca proyek published | Lihat draft, lihat gambar draft, ubah proyek, baca & kirim inquiry |
| Login bukan staf | Sama seperti pengunjung | Buat proyek, lihat inquiry |
| Staf studio | Lihat draft, kelola proyek, baca inquiry | Membuat inquiry |
| Backend Go (`service_role`) | Menyimpan inquiry | — |

Tes ini sudah dibuktikan bisa gagal: saat policy select dilonggarkan supaya
draft ikut terlihat publik, tes berhenti dengan `GAGAL`.

## 4. Buat akun staf

**Authentication → Users → Add user**, isi email dan password, salin UUID-nya.
Lalu di **SQL Editor**:

```sql
insert into public.profiles (id, full_name, role)
values ('<uuid>', 'Nama Kamu', 'admin');
```

Punya akun Supabase tidak membuat seseorang jadi staf. Policy `is_staff()`
memeriksa keberadaan baris di `public.profiles` — user tanpa baris di situ
diperlakukan seperti pengunjung biasa.

## 5. Buktikan tersambung

Tanpa perlu menjalankan Worker API dulu:

```bash
./scripts/verify-supabase.sh "$SUPABASE_DIRECT_URL"
```

Untuk membuktikan Worker API-nya sendiri tersambung (butuh Hyperdrive, lihat
Fase 04 di [`deployment.md`](deployment.md)):

```bash
cd apps/api && npm install && npm run dev   # http://localhost:8787

# terminal lain:
curl localhost:8787/healthz
# {"env":"development","status":"ok"}

curl localhost:8787/api/v1/projects
# {"data":[],"meta":{"count":0,"limit":12,"offset":0}}
```

`data` kosong itu **benar** — belum ada proyek published. Yang dibuktikan di
sini adalah Hyperdrive hidup dan query berjalan. Untuk melihat data contoh,
tempel `supabase/seed.sql` ke SQL Editor.

## Yang belum perlu disentuh di Supabase

**Storage** sengaja dimatikan di `supabase/config.toml` — foto proyek ditaruh di
Cloudflare R2 karena egress-nya gratis. **Edge Functions** juga tidak dipakai;
logika ada di Worker API sendiri.

## Tahap berikutnya

1. Cloudflare R2 — bucket media dan backup, plus custom domain
2. Turnstile — site key dan secret key untuk form kontak
3. Resend — notifikasi email, perlu verifikasi domain
4. Worker API — Hyperdrive, rahasia, dan deploy (`./scripts/setup-fase-04.sh`)
5. Worker situs statis — deploy frontend

Rinciannya di [`deployment.md`](deployment.md) dan [`layanan.md`](layanan.md).
