# Setup Supabase

Dari layar **New project** sampai database siap dipakai backend Go. Tujuh
langkah, sekitar 20 menit.

Versi web panduan ini: https://claude.ai/code/artifact/d975c708-cac7-4c4d-acfa-fae304f1e017

## 1. Pilih organisasi dulu — di sinilah $10/bulan diputuskan

Membuat project di `sheetcodeid-ux's Org` berbiaya **$10/bulan**, karena org itu
berplan Pro dan menagih per project. Supabase menyelipkan jalan keluarnya di
kotak bawah layar: kamu masih punya jatah **2 project gratis**, tapi hanya bisa
dipakai lewat organisasi berplan Free.

| | Org Free baru | Tetap di org Pro |
| --- | --- | --- |
| Biaya | **$0** | $10/bulan |
| Database | 500 MB | 8 GB |
| Egress | 5 GB | 250 GB |
| Tidur saat idle | Ya, setelah 7 hari | Tidak |
| Backup terkelola | Tidak | Harian |

**Rekomendasi: org Free.** Website ini hanya menyimpan teks — foto proyek ada di
R2 — jadi 500 MB sangat longgar. Dua kelemahan plan Free juga sudah ditutup oleh
yang kita bangun: workflow `backup-db.yml` melakukan `pg_dump` harian ke R2, dan
koneksi harian itu sekaligus mencegah project tertidur.

> Kalau memilih org Free, connector Supabase di sesi Claude perlu disambungkan
> ulang agar project barunya terlihat. Seluruh langkah di bawah bisa dijalankan
> sendiri tanpa connector.

## 2. Isi form New Project

| Kolom | Isi | Alasan |
| --- | --- | --- |
| Project name | `pahlevidirga-web` | Nama panjang akan muncul di banyak tempat sempit |
| GitHub | **kosongkan** | Integrasi ini menerapkan migrasi dari branch produksi. Migrasi kita masih di branch `claude/stack-setup-…`, jadi belum ada yang bisa dikerjakannya. Sambungkan setelah di-merge ke `main` |
| Database password | Generate → **simpan** | Masuk ke `DATABASE_URL` dan tidak bisa dilihat lagi setelah halaman ditutup |
| Region | **Southeast Asia (Singapore)** | ±30 ms dari Indonesia. Jangan Seoul seperti `operation-gwg`. Tidak bisa diubah setelah project dibuat |
| Enable Data API | biarkan menyala | Dipakai Supabase Studio. Frontend kita tidak memakainya |
| Automatically expose new tables | **MATIKAN** | lihat di bawah |
| Enable automatic RLS | **NYALAKAN** | Jaring pengaman untuk tabel yang kamu buat sendiri nanti |

### Kenapa dua checkbox terakhir penting

Kalau "automatically expose new tables" menyala, setiap tabel baru otomatis
diberi hak `all` untuk role `anon` — artinya pengunjung anonim punya izin
INSERT, UPDATE, dan DELETE, dan satu-satunya penjaga tinggal ketepatan tiap
policy RLS. Supabase sendiri menulis *"We recommend disabling this"*.

Saat menguji migrasi ini di Postgres lokal, ketahuan bahwa RLS hanya menyaring
**baris** — yang menentukan sebuah role boleh menyentuh tabelnya sama sekali
adalah `GRANT`. Migrasi `20260818000002` sekarang mencabut semua hak lebih dulu
lalu memberikan seperlunya, jadi mematikan opsi ini tidak merusak apa pun.

## 3. Salin lima kredensial

Semua ada di **Project Settings**.

| Nilai | Lokasi | Dipakai sebagai |
| --- | --- | --- |
| Connection string — Transaction pooler (6543) | Database → Connection pooling | `DATABASE_URL` |
| Connection string — Direct (5432) | Database → Connection string | `SUPABASE_DIRECT_URL` (backup & tes RLS) |
| JWT Secret | API → JWT Settings | `SUPABASE_JWT_SECRET` |
| service_role key | API → Project API keys | `SUPABASE_SERVICE_ROLE_KEY` |
| Project URL | API | `SUPABASE_URL` |

> `service_role` melewati seluruh RLS. Kunci ini hanya boleh hidup di environment
> backend — Cloud Run atau `apps/api/.env` yang tidak pernah di-commit.

Dua string koneksi berbeda peran: **pooler** untuk API Go, karena Cloud Run bisa
menaikkan banyak instance dan koneksi langsung akan cepat kehabisan slot;
**direct** untuk `pg_dump` dan `psql` yang butuh session penuh.

## 4. Terapkan skema

```bash
git fetch origin
git checkout claude/stack-setup-supabase-cloudflare-kdwlkk

# project-ref ada di URL dashboard: /project/<ref>
supabase link --project-ref <project-ref>
supabase db push
```

Yang terpasang: `20260818000001_init_schema` (tabel `projects`,
`project_images`, `inquiries`, `profiles`) dan `20260818000002_rls_policies`.

## 5. Verifikasi RLS sebelum percaya

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

## 6. Buat akun staf

**Authentication → Users → Add user**, isi email dan password, salin UUID-nya.
Lalu di **SQL Editor**:

```sql
insert into public.profiles (id, full_name, role)
values ('<uuid>', 'Nama Kamu', 'admin');
```

Punya akun Supabase tidak membuat seseorang jadi staf. Policy `is_staff()`
memeriksa keberadaan baris di `public.profiles` — user tanpa baris di situ
diperlakukan seperti pengunjung biasa.

## 7. Jalankan backend dan buktikan tersambung

```bash
cp .env.example apps/api/.env
```

Isi tiga baris ini saja; sisanya boleh kosong untuk sekarang:

```
DATABASE_URL=<connection string pooler, port 6543>
SUPABASE_JWT_SECRET=<jwt secret>
IP_HASH_SALT=<openssl rand -hex 32>
```

```bash
cd apps/api && make run
```

Di terminal lain:

```bash
curl localhost:8080/healthz
# {"env":"development","status":"ok"}

curl localhost:8080/api/v1/projects
# {"data":[],"meta":{"count":0,"limit":12,"offset":0}}
```

`data` kosong itu **benar** — belum ada proyek published. Yang dibuktikan di
sini adalah koneksi pooler hidup dan query berjalan. Untuk melihat data contoh,
tempel `supabase/seed.sql` ke SQL Editor.

## Yang belum perlu disentuh di Supabase

**Storage** sengaja dimatikan di `supabase/config.toml` — foto proyek ditaruh di
Cloudflare R2 karena egress-nya gratis. **Edge Functions** juga tidak dipakai;
logika ada di API Go.

## Tahap berikutnya

1. Cloudflare R2 — bucket media dan backup, plus custom domain
2. Turnstile — site key dan secret key untuk form kontak
3. Resend — notifikasi email, perlu verifikasi domain
4. Cloud Run — deploy API Go
5. Cloudflare Pages — deploy frontend

Rinciannya di [`deployment.md`](deployment.md) dan [`layanan.md`](layanan.md).
