# Pahlevi Dirga — Website Studio Arsitektur

Konteks tetap untuk sesi Claude Code di repo ini. File ini dibaca otomatis di
awal setiap sesi, jadi isinya keputusan yang harus tetap berlaku — bukan catatan
progres. Bahasa percakapan dan komentar kode: **Indonesia**.

## Untuk siapa website ini

Studio arsitektur kecil. Skalanya nyata dan sengaja dicatat karena memengaruhi
hampir setiap keputusan teknis:

- ~7 klien per bulan
- **2 akun** yang menulis: superadmin dan satu staf penginput
- Klien adalah pengunjung biasa, tidak punya akun (bisa berubah nanti)

Artinya: kapasitas tidak pernah jadi masalah, tapi **beban pemeliharaan** iya.
Kalau ragu antara solusi canggih dan solusi yang bisa dipahami enam bulan lagi
oleh orang yang bisnisnya arsitektur — pilih yang kedua.

## Stack

| Lapisan | Pakai | Region |
| --- | --- | --- |
| Frontend | Astro statis di Cloudflare Pages | edge |
| Gambar | Cloudflare R2 | edge |
| API | Go Fiber di Cloud Run | `asia-southeast1` |
| Database + Auth | Supabase (plan Free) | `ap-southeast-1` |
| Email | Resend | — |
| Anti-bot | Cloudflare Turnstile | — |

Tanpa Vercel — keputusan eksplisit pemilik.

Supabase: org `pahlevidirgadesignarchitecture`, project `pahlevidirga-web`.
Integrasi GitHub aktif, jadi migrasi di `supabase/migrations/` diterapkan
otomatis begitu branch produksi berubah.

## Invarian arsitektur

Langgar ini dan ada yang rusak diam-diam:

1. **Frontend tidak pernah bicara ke Supabase.** Semua lewat API Go. Anon key
   tidak dipakai di browser sama sekali.
2. **`service_role` hanya hidup di backend.** Tidak pernah di frontend, tidak
   pernah di-commit.
3. **Gambar di R2, bukan Supabase Storage.** Storage Supabase dimatikan di
   `config.toml`. R2 punya egress gratis; Supabase Free hanya 5 GB.
4. **Halaman proyek dirender saat build.** Pengunjung tidak pernah menyentuh
   Cloud Run — hanya form kontak dan panel admin yang menyentuhnya. Ini yang
   membuat seluruh stack muat di free tier dan membuat biaya Cloud Run di
   region Singapura tetap di bawah $1/bulan.
5. **Konten baru butuh build ulang.** Panggil Deploy Hook Cloudflare Pages
   setelah konten berubah.

## Invarian keamanan

Dua hal ini pernah salah dan sudah diperbaiki — jangan diulang:

1. **RLS saja tidak cukup; GRANT yang menentukan akses tabel.** Supabase
   memberi `all` kepada `anon` untuk tabel baru lewat default privileges.
   Migrasi mencabutnya lalu memberi seperlunya. Setelan "Automatically expose
   new tables" di dashboard harus **mati**.
2. **Backend melewati RLS, jadi status staf harus dicek di aplikasi.** Token
   Supabase yang sah hanya membuktikan "punya akun", bukan "berhak mengelola".
   Setiap endpoint admin wajib lewat `RequireSupabaseAuth` **dan**
   `RequireStaff`. `RequireStaff` sengaja gagal-tertutup.

Aturan turunannya: **tabel baru selalu disertai GRANT eksplisit dan assertion
di `supabase/tests/rls_test.sql`.** Tes itu harus tetap bisa gagal — kalau
menambah assertion, buktikan ia merah dulu sebelum dibuat hijau.

## Desain

Bahasa visual: **neo-brutalism**, gabungan inspirasi dari Wise, Framer, dan
Gumroad. Referensi visual datang dari pemilik berupa gambar; jangan mengarang
arah visual sendiri.

**Halaman UI Component adalah satu-satunya sumber kebenaran komponen.** Hanya
master admin yang bisa membukanya. Saat membangun fitur baru, ambil komponen
dari sana — jangan membuat komponen baru kecuali diminta, dan kalau membuat,
daftarkan ke halaman itu. Inventaris dan urutan pengerjaan ada di
`docs/design-system.md`.

Catatan: `apps/web/src/styles/global.css` masih memakai palet editorial hangat
(kertas/tinta, Cormorant Garamond) dari scaffold awal. Itu **belum** diselaraskan
dengan arah neo-brutalism dan perlu diputuskan apakah situs publik ikut berubah
atau hanya panel admin.

## Perintah

| Perintah | Kegunaan |
| --- | --- |
| `cd apps/api && make test` | Test Go + race detector |
| `cd apps/api && make lint` | `go vet` + cek format |
| `cd apps/web && npm run check` | Typecheck Astro |
| `cd apps/web && npm run build` | Build statis |
| `./scripts/verify-supabase.sh "$SUPABASE_DIRECT_URL"` | Periksa skema, RLS, GRANT, akun staf |
| `psql "$SUPABASE_DIRECT_URL" -f supabase/tests/rls_test.sql` | 11 assertion RLS |
| `./scripts/build-bootstrap.sh` | Regenerate `supabase/bootstrap.sql` |

`supabase/bootstrap.sql` **hasil generate** — ubah migrasinya, lalu jalankan
skrip; jangan sunting hasilnya.

## Cara kerja yang diharapkan

- Branch pengembangan: `claude/stack-setup-supabase-cloudflare-kdwlkk`
- Jangan buat pull request kecuali diminta
- Verifikasi dengan menjalankan, bukan dengan membaca. Tidak ada Docker di
  container sesi; Postgres 16 tersedia di `/usr/lib/postgresql/16/bin` dan bisa
  dijalankan sebagai user non-root untuk menguji migrasi dan RLS sungguhan
- Laporkan apa adanya. Kalau sesuatu tidak bisa diverifikasi, katakan — jangan
  klaim beres

## Riwayat keputusan

| Keputusan | Alasan |
| --- | --- |
| Go Fiber, bukan serverless | Pilihan pemilik; sudah dipertimbangkan ulang sekali dan ditegaskan |
| Cloud Run Singapura, bukan free tier AS | Free tier Cloud Run hanya di region AS; database di Singapura, dan API tidak dilalui pengunjung sehingga biayanya beberapa sen |
| Supabase di org Free terpisah | Menggabung ke `operation-gwg` (database operasional GWG yang live) akan berbagi `auth.users`, backup, dan radius kerusakan kredensial |
| Astro statis, bukan SSR | Pengunjung tidak perlu menunggu backend; Cloud Run boleh tidur |
| Rate limiter in-memory | Per instance, jadi lebih longgar dari angkanya. Diterima pada skala ini; Turnstile penjaga sesungguhnya |
