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
| API | Hono di Cloudflare Workers, Postgres lewat Hyperdrive | edge |
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
menyajikan situs statis dari `apps/web/dist` lewat `wrangler.jsonc` di akar,
tayang di `pahlevidirgadesignarchitectureweb.pahlevidirgadesignarchitecture.workers.dev`.
Worker kedua, `pahlevidirga-api`, menjalankan API (`apps/api/wrangler.jsonc`) —
Postgres diakses lewat binding Hyperdrive (bukan koneksi langsung dari
Worker), rate limit `/auth/login` dan `/inquiries` lewat KV (bukan in-memory,
karena Worker tidak menyimpan state antar-request), R2 diakses lewat binding
`MEDIA` untuk presigned upload. Bucket R2 `pahlevidirga-media` (lokasi APAC)
dengan CORS presigned upload dan widget Turnstile "Form kontak pahlevidirga"
sudah ada. Domain publik R2 memakai custom domain `media.pahlevidirgaarchitecture.com`
(bukan lagi `r2.dev` bawaan yang kena rate limit dan sempat gagal SSL di
sebagian browser/OS).

> **Satu login, dua akun.** Login `sheetcode.id@gmail.com` juga memuat akun
> `Sheetcode.id@gmail.com's Account` yang berisi proyek lain yang tidak ada
> hubungannya dengan web ini. **Jangan pernah membuat atau mengubah apa pun di
> akun itu.** Connector kadang memakai akun Sheetcode sebagai bawaan, jadi
> sebutkan account ID Dirga secara eksplisit di setiap panggilan — jangan
> mengandalkan nilai bawaan.

## Invarian arsitektur

Langgar ini dan ada yang rusak diam-diam:

1. **Frontend tidak pernah bicara ke Supabase.** Semua lewat API — termasuk
   login, yang ditukar di `/api/v1/auth/login`. Anon key hidup di Worker API
   saja dan tidak pernah sampai ke browser.
2. **`service_role` hanya hidup di Worker API.** Tidak pernah di frontend,
   tidak pernah di-commit — disetel lewat `wrangler secret put`.
3. **Gambar di R2, bukan Supabase Storage.** Storage Supabase dimatikan di
   `config.toml`. R2 punya egress gratis; Supabase Free hanya 5 GB.
4. **Halaman proyek dirender saat build.** Pengunjung tidak pernah menyentuh
   Worker API — hanya form kontak dan panel admin yang menyentuhnya. Karena
   Workers scale-to-zero secara native dan tidak ditagih per-region seperti
   Cloud Run dulu, ini juga yang menjaga biayanya tetap di free tier tanpa
   perlu menimbang region.
5. **Konten baru butuh build ulang.** Deploy ulang Worker statis setelah
   konten berubah — halaman proyek dibekukan saat build.

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

## Alur persetujuan tampilan

Aturan pemilik, berlaku untuk **setiap** perubahan yang kelihatan mata:

> Kirim gambarnya dulu. Kalau di-ACC baru deploy; kalau belum, ulangi.

Jadi urutannya selalu: ubah kode → jalankan halamannya di browser → kirim
tangkapan layarnya lewat lampiran → **tunggu ACC** → baru commit ke branch
produksi. Boleh commit ke branch kerja sambil menunggu, tapi jangan merge.
Alasannya bukan formalitas: satu putaran deploy yang salah memakan waktu
pemilik untuk memeriksa, dan pemilik menjunjung tinggi estetika — dia yang
menilai, bukan saya.

**Kalau pemilik mengirim gambar referensi, samakan dengan mengukur, bukan
dengan mengira.** Cara yang terbukti bekerja di sesi sebelumnya:

1. Ukur elemen di gambar referensi sebagai **persentase terhadap wadahnya**
   (lebar kolom, lebar kartu), bukan piksel — tangkapan layar pemilik dan
   viewport saya beda skala, jadi angka piksel mentah menyesatkan
2. Terapkan persentase itu di CSS
3. Buka halamannya dengan Playwright (`/opt/pw-browsers/chromium`) dan baca
   `getBoundingClientRect()` serta `getComputedStyle()` — bandingkan angkanya
   dengan referensi, jangan menilai dari melihat tangkapan layar
4. Laporkan angkanya ke pemilik bersama gambarnya, termasuk yang meleset

Kalau permintaan pemilik bentrok dengan referensinya sendiri (mis. referensi
aslinya bisa digulir sementara halaman kita tidak boleh), kerjakan yang paling
mendekati, lalu **sebutkan bentroknya secara terbuka** dan biar pemilik yang
memutuskan. Jangan diam-diam memilih salah satu.

## Jebakan yang sudah pernah menggigit

Tiga hal ini pernah memakan berjam-jam. Baca sebelum menyalahkan CSS:

1. **`:has(> .anak)` tidak pernah cocok untuk komponen island.** Astro
   membungkus komponen `client:load` dalam `<astro-island>` yang memakai
   `display: contents`. Tata letaknya berperilaku seolah anaknya langsung,
   tapi bagi CSS pembungkus itu tetap ada. Tulis `:has(.anak)` tanpa `>`.
2. **Persentase `padding` dihitung dari lebar-dalam INDUK, bukan elemennya
   sendiri.** `padding: 0 7%` di kolom selebar 584px yang induknya 1168px
   menghasilkan 82px, bukan 41px. Untuk padding pakai nilai tetap; persentase
   lebar anak baru dihitung terhadap kotak-dalam kolom (lebar kolom dikurangi
   padding-nya).
3. **`aspect-ratio`, bukan `flex: 1`, kalau bentuknya harus tetap.** `flex: 1`
   membuat tinggi mengikuti sisa ruang viewport, jadi kotak yang seharusnya
   melebar berubah jadi hampir persegi di layar pendek.

## Perintah

| Perintah | Kegunaan |
| --- | --- |
| `cd apps/api && npm test` | Test API (vitest) |
| `cd apps/api && npm run typecheck` | Typecheck API |
| `cd apps/api && npx wrangler deploy --dry-run` | Periksa bundling & binding Worker API tanpa deploy |
| `cd apps/web && npm run check` | Typecheck Astro |
| `cd apps/web && npm run build` | Build statis |
| `cd apps/web && npm run dev` + Playwright | Ukur tampilan di browser sungguhan sebelum minta ACC |
| `./scripts/verify-supabase.sh "$SUPABASE_DIRECT_URL"` | Periksa skema, RLS, GRANT, akun staf |
| `psql "$SUPABASE_DIRECT_URL" -f supabase/tests/rls_test.sql` | 13 assertion RLS |
| `./scripts/build-bootstrap.sh` | Regenerate `supabase/bootstrap.sql` |
| `./scripts/setup-fase-04.sh` | Provisioning Hyperdrive + rahasia Worker API, lalu deploy |

`supabase/bootstrap.sql` **hasil generate** — ubah migrasinya, lalu jalankan
skrip; jangan sunting hasilnya.

## Cara kerja yang diharapkan

- **Branch produksi: `claude/stack-setup-supabase-cloudflare-kdwlkk`.** Push ke
  sini yang memicu deploy, jadi jangan dipakai untuk coba-coba. Kerjakan di
  branch sesi, lalu merge ke sini setelah pemilik ACC
- Jangan buat pull request kecuali diminta
- **Deploy otomatis lewat GitHub Actions** (`.github/workflows/deploy.yml`)
  begitu branch produksi berubah — jangan pernah minta pemilik menjalankan
  `wrangler deploy` tangan lagi. Butuh secret repo `CLOUDFLARE_API_TOKEN`
  (sudah terpasang)
- **Rahasia tidak pernah lewat percakapan.** Kalau butuh token baru, tuntun
  pemilik menempelkannya langsung ke UI GitHub Secrets. Token yang pernah
  terkirim ke chat harus dianggap bocor dan dicabut, bukan dipakai
- **Jaringan sesi ini memblokir Cloudflare sepenuhnya** — `api.cloudflare.com`
  maupun `*.workers.dev` sama-sama kena 403 dari gateway. Artinya saya tidak
  bisa membuka situs yang sudah tayang untuk memeriksanya sendiri. Yang bisa
  dipakai sebagai bukti tayang: status run di tab Actions **dan** stempel
  `modified_on` kedua Worker lewat konektor Cloudflare (yang read-only).
  Sebutkan keterbatasan ini ke pemilik, jangan mengaku sudah memeriksa
- **Mesin pemilik ada dua**: MacBook pribadi (yang dipakai sehari-hari) dan
  komputer kantor ber-PowerShell. Jangan menulis perintah shell yang
  mengasumsikan salah satunya — dan sejak deploy otomatis, pemilik memang
  tidak perlu menjalankan apa pun
- Verifikasi dengan menjalankan, bukan dengan membaca. Tidak ada Docker di
  container sesi; Postgres 16 tersedia di `/usr/lib/postgresql/16/bin` dan bisa
  dijalankan sebagai user non-root untuk menguji migrasi dan RLS sungguhan
- Laporkan apa adanya. Kalau sesuatu tidak bisa diverifikasi, katakan — jangan
  klaim beres

## Riwayat keputusan

| Keputusan | Alasan |
| --- | --- |
| Hono di Cloudflare Workers, bukan Go Fiber di Cloud Run | Dibalik dari keputusan sebelumnya ("Go Fiber, bukan serverless") atas permintaan eksplisit pemilik — satu platform (Cloudflare) untuk frontend, API, R2, dan DNS, tanpa akun Google Cloud terpisah. Konsekuensinya: seluruh backend ditulis ulang dari Go ke TypeScript, bukan sekadar pindah hosting |
| Hyperdrive, bukan koneksi Postgres langsung dari Worker | Worker tidak bisa membuka pool koneksi jangka panjang seperti pgxpool — Hyperdrive yang menyediakan pooling itu di sisi Cloudflare |
| Rate limit lewat KV, bukan in-memory | Worker tidak menyimpan state antar-request sama sekali, beda dari instance Cloud Run yang setidaknya bertahan selama masih hangat. KV tersebar di seluruh edge — lebih ketat dari limiter in-memory sebelumnya, dengan trade-off baca-tulis yang tidak atomik dan propagasi hingga ~60 detik. Diterima dengan alasan yang sama seperti sebelumnya: Turnstile penjaga sesungguhnya |
| Supabase di org Free terpisah | Menggabung ke `operation-gwg` (database operasional GWG yang live) akan berbagi `auth.users`, backup, dan radius kerusakan kredensial |
| Astro statis, bukan SSR | Pengunjung tidak perlu menunggu backend; Worker API boleh dingin |
| Deploy lewat GitHub Actions, bukan tangan | Deploy sebelumnya harus dijalankan pemilik dari komputer kantor, jadi kode yang sudah di-merge bisa menganggur berhari-hari — dan pernah tayang setengah jalan karena satu Worker ter-deploy dan satunya tidak. Sesi Claude tidak bisa menggantikannya karena jaringannya memblokir Cloudflare |
| Kirim pratinjau sebelum deploy, bukan deploy lalu perbaiki | Permintaan eksplisit pemilik setelah beberapa putaran perbaikan yang meleset. Yang menilai estetika adalah pemilik; memeriksa gambar jauh lebih murah baginya ketimbang memeriksa situs yang sudah tayang |
| Logo studio di R2 dengan folder `studio/`, bukan tabel terpisah | Satu kolom `logo_key` di `studio_settings` sudah cukup untuk satu logo. Folder dipisah dari `projects/` supaya berkas studio tidak ikut terhapus saat proyek dibersihkan |
