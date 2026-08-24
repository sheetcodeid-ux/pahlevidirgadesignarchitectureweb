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
| Frontend | Astro statis di Cloudflare Workers (Static Assets) | edge |
| Gambar | Cloudflare R2 | edge |
| API | Go Fiber di Cloud Run | `asia-southeast1` |
| Database + Auth | Supabase (plan Free) | `ap-southeast-1` |
| Email | Resend | — |
| Anti-bot | Cloudflare Turnstile | — |

Tanpa Vercel — keputusan eksplisit pemilik.

Supabase: org `pahlevidirgadesignarchitecture`, project `pahlevidirga-web`,
ref `ddzuzokkqofrpkpokcfa`, region `ap-southeast-1`. Direct connection hanya
menerima IPv6 dan plan Free tidak punya add-on IPv4, jadi dari mesin biasa
pakai **session pooler** port 5432 — bukan transaction pooler 6543, yang tidak
mempertahankan `set local role` sehingga tes RLS jadi tak berarti.
Integrasi GitHub aktif, jadi migrasi di `supabase/migrations/` diterapkan
otomatis begitu branch produksi berubah.

Cloudflare: akun **`pahlevidirgadesignarchitecture`**, ID
`cf6a6bde45d3fd8a93463e6cc7e71aa1`. Worker `pahlevidirgadesignarchitectureweb`
menyajikan situs statis dari `apps/web/dist` lewat `wrangler.jsonc` di akar.

> **Satu login, dua akun.** Login `sheetcode.id@gmail.com` juga memuat akun
> `Sheetcode.id@gmail.com's Account` yang berisi proyek lain yang tidak ada
> hubungannya dengan web ini. **Jangan pernah membuat atau mengubah apa pun di
> akun itu.** Connector kadang memakai akun Sheetcode sebagai bawaan, jadi
> sebutkan account ID Dirga secara eksplisit di setiap panggilan — jangan
> mengandalkan nilai bawaan.

## Invarian arsitektur

Langgar ini dan ada yang rusak diam-diam:

1. **Frontend tidak pernah bicara ke Supabase.** Semua lewat API Go — termasuk
   login, yang ditukar di `/api/v1/auth/login`. Anon key hidup di backend saja
   dan tidak pernah sampai ke browser.
2. **`service_role` hanya hidup di backend.** Tidak pernah di frontend, tidak
   pernah di-commit.
3. **Gambar di R2, bukan Supabase Storage.** Storage Supabase dimatikan di
   `config.toml`. R2 punya egress gratis; Supabase Free hanya 5 GB.
4. **Halaman proyek dirender saat build.** Pengunjung tidak pernah menyentuh
   Cloud Run — hanya form kontak dan panel admin yang menyentuhnya. Ini yang
   membuat seluruh stack muat di free tier dan membuat biaya Cloud Run di
   region Singapura tetap di bawah $1/bulan.
5. **Konten baru butuh build ulang.** Deploy ulang Worker setelah konten
   berubah — halaman proyek dibekukan saat build.

## Invarian keamanan

Dua hal ini pernah salah dan sudah diperbaiki — jangan diulang:

1. **RLS saja tidak cukup; GRANT yang menentukan akses.** Supabase memberi
   `all` kepada `anon` untuk tabel baru lewat default privileges. Migrasi
   `20260824000003` membalik bawaannya, jadi tabel baru tertutup dan wajib
   disertai GRANT eksplisit.

   Berlaku juga untuk **fungsi**, dan di situ ada jebakan tersendiri: Postgres
   memberi `execute` kepada **PUBLIC**, bukan kepada `anon`. Mencabut dari
   `anon` tidak menutup apa pun — harus `revoke ... from public`. Pernah kena
   sekali di `is_staff()`, diperbaiki di `20260824000004`.
2. **Backend melewati RLS, jadi status staf harus dicek di aplikasi.** Token
   Supabase yang sah hanya membuktikan "punya akun", bukan "berhak mengelola".
   Setiap endpoint admin wajib lewat `RequireSupabaseAuth` **dan**
   `RequireStaff`. `RequireStaff` sengaja gagal-tertutup.

Aturan turunannya: **tabel baru selalu disertai GRANT eksplisit dan assertion
di `supabase/tests/rls_test.sql`.** Tes itu harus tetap bisa gagal — kalau
menambah assertion, buktikan ia merah dulu sebelum dibuat hijau.

## Desain

Berlaku untuk **seluruh situs**, publik maupun admin — bukan panel admin saja.

Arah visualnya diturunkan dari 27 tangkapan layar referensi milik pemilik:
gelap sebagai bawaan, radius besar, border 1px yang nyaris tak terlihat, tanpa
bayangan keras. Pemilik menyebutnya "neo-brutalism"; wujud yang sebenarnya
lebih dekat ke dark premium SaaS, dan itulah yang ditiru.

Aturan yang mengikat:

1. **Warna punya makna tetap.** Putih/hitam = aksi utama, merah = brand dan
   destruktif, amber = terbatas atau terkunci sebagian, ungu = upgrade dan
   fitur berbayar, hijau = status hidup dan konfirmasi, biru = penjelasan.
   Ungu tidak pernah dipakai untuk aksi biasa.
2. **Serif untuk judul halaman dan momen bernada manusia; sans untuk perkakas;
   mono untuk data dan angka.** Newsreader / Plus Jakarta Sans / IBM Plex Mono.
3. **Ikon selalu SVG inline** dari `apps/web/src/components/ui/Icon.tsx`. Tanpa
   emoji, tanpa icon-font. Ikon wajib cocok maknanya dengan label di sebelahnya.
4. **Tidak ada nilai warna literal di komponen.** Semuanya menunjuk token di
   `apps/web/src/styles/tokens.css`.
5. **Tema terang bukan pembalikan otomatis.** Tiap warna semantik punya nilai
   sendiri per tema, karena amber dan hijau versi gelap pudar di atas putih.
6. **Responsif wajib**, termasuk ponsel sempit. Tidak boleh ada gulir
   horizontal pada badan halaman.

**Halaman UI Component (`/admin/ui`) adalah satu-satunya sumber kebenaran
komponen.** Hanya master admin yang bisa membukanya. Seluruh 64 komponen sudah
dibangun. Saat membangun fitur baru, ambil komponen dari sana — jangan membuat
komponen baru kecuali diminta, dan kalau membuat, daftarkan ke halaman itu.
Inventaris lengkapnya ada di `docs/design-system.md`.

Komponen yang butuh perilaku rumit memakai primitif headless; yang bisa
dikerjakan elemen HTML asli tetap memakai elemen aslinya (`<details>` untuk
Accordion, `<input type=file>` untuk Attachment, `<input type=range>` untuk
Slider). Itu bukan kemalasan — perilaku bawaan tidak bisa rusak diam-diam.

Frontend memakai Astro dengan island React untuk komponen interaktif. Primitif
headless dipakai untuk lapisan perilaku overlay (focus trap, ARIA, penempatan);
seluruh tampilan tetap ditulis sendiri.

**Penjagaan halaman UI Component adalah penjagaan tampilan, bukan keamanan.**
Situs ini statis, jadi markup-nya sudah sampai di browser sebelum pemeriksaan
berjalan. Itu diterima karena halaman itu hanya berisi contoh komponen. Kalau
nanti ada halaman admin yang memuat data sungguhan, penjagaannya harus pindah
ke edge (Cloudflare Access di depan `/admin/*`) — jangan mengandalkan
`MasterGuard`.

## Perintah

| Perintah | Kegunaan |
| --- | --- |
| `cd apps/api && make test` | Test Go + race detector |
| `cd apps/api && make lint` | `go vet` + cek format |
| `cd apps/web && npm run check` | Typecheck Astro |
| `cd apps/web && npm run build` | Build statis |
| `./scripts/verify-supabase.sh "$SUPABASE_DIRECT_URL"` | Periksa skema, RLS, GRANT, akun staf |
| `psql "$SUPABASE_DIRECT_URL" -f supabase/tests/rls_test.sql` | 13 assertion RLS |
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
