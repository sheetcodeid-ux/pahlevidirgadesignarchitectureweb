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
**Migrasi TIDAK diterapkan otomatis.** Catatan lama di file ini menyebut
integrasi GitHub menerapkannya begitu branch produksi berubah — itu tidak
benar, dan sudah sekali membuat produksi rusak: Worker API tayang menanyakan
kolom yang belum ada di database. Riwayat `list_migrations` membuktikannya —
semua versinya bertanda waktu saat diterapkan tangan lewat konektor, bukan
nama file migrasinya.

Jadi setiap kali ada berkas baru di `supabase/migrations/`, urutannya:
**terapkan migrasi ke produksi LEBIH DULU lewat konektor Supabase
(`apply_migration`), baru merge ke branch produksi.** Kolom baru selalu
kompatibel-mundur (API lama tidak menyebutnya), sementara API baru yang
tayang sebelum kolomnya ada langsung gagal. Setelah menerapkan, buktikan
kolomnya benar-benar ada lewat `execute_sql` — jangan menganggap berhasil
karena `apply_migration` membalas success.

**Proteksi password bocor Supabase tidak bisa dinyalakan di plan Free** —
dokumennya menyebut ia Pro ke atas, dan sakelarnya memang mati permanen di
dashboard. Advisor keamanan Supabase tetap melaporkannya sebagai peringatan;
itu bukan sesuatu yang bisa diperbaiki, jadi jangan menyuruh pemilik
menyalakannya. Yang sudah dipakai sebagai gantinya, dan gratis: panjang
password minimum **12** dan Password Requirements paling ketat (huruf besar,
huruf kecil, angka, simbol).

**Peringatan advisor `is_staff()` juga TIDAK boleh "diperbaiki".** Advisor
mengeluh `authenticated` bisa memanggil `public.is_staff()` yang
SECURITY DEFINER, dan menyarankan mencabut EXECUTE. Jangan. Fungsi itu
dipanggil dari dalam policy RLS yang berjalan sebagai peran pemanggil, jadi
mencabutnya membunuh policy-nya sendiri: sudah dicoba, dan `rls_test.sql`
langsung jatuh dari **65 assertion lulus jadi 4**, sisanya
`permission denied for function is_staff`. Fungsinya sendiri tidak bocor
apa-apa — ia hanya menjawab benar/salah tentang si pemanggil sendiri.
Peringatan ketiga muncul bersama `content_revision` dan juga sengaja:
advisor melaporkan `rls_enabled_no_policy` (tingkat INFO) karena tabel itu
menyalakan RLS tanpa satu pun policy. Itu persis maksudnya — tidak ada peran
yang boleh menyentuhnya selain pemilik database, dan Worker API membacanya
lewat Hyperdrive yang memang melewati RLS. Menambahkan policy justru berarti
membuka akses yang sekarang tertutup rapat.

Jadi ketiga peringatan advisor yang tersisa memang sengaja dibiarkan; kalau
suatu saat jumlahnya bertambah, yang baru itulah yang perlu dilihat.

**Cache query Hyperdrive HARUS mati.** Bawaannya menyala (60 detik) dan itu
sudah menggigit: foto yang baru diunggah tidak muncul, cover yang baru
dipilih tidak berubah, dan refresh browser tidak menolong karena cache-nya
di edge. Setelannya di dashboard Cloudflare → Hyperdrive → `pahlevidirga-db`
→ Caching, dan **sudah dimatikan tangan oleh pemilik.** Kalau ada laporan
"data lama" lagi, periksa setelan ini lebih dulu.

Langkah otomatis untuk menguncinya sempat ada di workflow deploy lalu
dilepas: `npx wrangler hyperdrive update ... --caching-disabled` ditolak
dengan Authentication error 10000 (run #26). **Jangan mencoba
mengembalikannya tanpa mengganti token lebih dulu** — sudah diselidiki
sampai habis, dan hasilnya ada di bawah.

Penyelidikan itu dijalankan lewat workflow terpisah
`.github/workflows/hyperdrive-cache.yml`, yang hanya jalan kalau
dijalankan tangan sehingga boleh merah tanpa menakut-nakuti siapa pun.
Run #1, 2 September 2026:

| Langkah | Hasil |
| --- | --- |
| `wrangler whoami` | hijau — token hidup, hanya melihat SATU akun: `pahlevidirgadesignarchitecture` |
| `wrangler hyperdrive list` (baca) | **merah**, error 10000 |
| `wrangler hyperdrive update` (tulis) | **merah**, error 10000 |

Dua kesimpulan, keduanya membatalkan catatan yang lebih lama di sini:

1. **Bukan soal dua akun.** Token hanya melihat akun Dirga, dan menyebut
   `CLOUDFLARE_ACCOUNT_ID` eksplisit tidak mengubah apa pun.
2. **Bukan cuma izin tulis.** MEMBACA daftar Hyperdrive saja sudah
   ditolak. Jadi token yang dipakai GitHub Actions tidak punya izin
   Hyperdrive sama sekali — padahal pemilik memeriksa
   `pahlevidirgadesignarchitectureweb build token` dan token itu memang
   memuat `Account · Hyperdrive · Edit`. Kemungkinan paling masuk akal:
   rahasia `CLOUDFLARE_API_TOKEN` di GitHub berisi token yang **berbeda**
   dari yang diperiksa. Tidak bisa dipastikan — nilai rahasianya tidak
   bisa dibaca, dan memang tidak boleh.

Dihentikan di situ dengan sengaja: yang dikunci cuma setelan yang sudah
mati, sementara menerbitkan token baru berarti pemilik harus membuat dan
menempelkannya ulang ke GitHub. Kalau tokennya suatu saat diganti karena
alasan lain, jalankan workflow itu sekali dari tab Actions; kalau hijau,
pindahkan langkah terakhirnya ke `deploy.yml`.

Cloudflare: akun **`pahlevidirgadesignarchitecture`**, ID
`cf6a6bde45d3fd8a93463e6cc7e71aa1`. Worker `pahlevidirgadesignarchitectureweb`
menyajikan situs statis dari `apps/web/dist` lewat `wrangler.jsonc` di akar,
tayang di **`pahlevidirgaarchitecture.com`** lewat custom domain — itu alamat
yang dipakai pemilik sehari-hari, termasuk `/admin`. Alamat bawaan
`pahlevidirgadesignarchitectureweb.pahlevidirgadesignarchitecture.workers.dev`
masih hidup tapi bukan yang dipakai; `site` di `astro.config.mjs` sudah
menunjuk domain kustomnya, jadi canonical dan kartu bagikan sudah benar.
Worker kedua, `pahlevidirga-api`, menjalankan API (`apps/api/wrangler.jsonc`) —
Postgres diakses lewat binding Hyperdrive (bukan koneksi langsung dari
Worker), rate limit `/auth/login` dan `/inquiries` lewat KV (bukan in-memory,
karena Worker tidak menyimpan state antar-request), R2 diakses lewat binding
`MEDIA` untuk presigned upload. Folder R2 dipisah per jenis aset: `projects/` untuk foto proyek, `studio/` untuk
logo studio, `klien/` untuk logo klien di marquee beranda — supaya aset yang
bukan milik proyek tidak ikut terhapus saat proyek dibersihkan.
Bucket R2 `pahlevidirga-media` (lokasi APAC)
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
5. **Jurnal tayang dari database, jadi tulisan baru BARU muncul setelah deploy
   berikutnya** — bukan langsung seperti data di panel admin. Itu konsekuensi
   halaman statis, bukan bug; sebutkan ke pemilik kalau dia bertanya kenapa
   tulisannya belum kelihatan.
6. **Konten baru butuh build ulang.** Deploy ulang Worker statis setelah
   konten berubah — halaman proyek dibekukan saat build.
7. **Header keamanan hidup di `apps/web/public/_headers`.** Situs statis
   tidak menjalankan kode Worker, jadi tidak ada tempat lain untuk menaruhnya.
   Berkas itu disalin apa adanya ke `dist` dan dibaca Workers Static Assets.
   CSP-nya sengaja mengizinkan `'unsafe-inline'` untuk skrip — Astro menaruh
   skrip inline di tiap halaman, dan mem-hash semuanya berarti CSP diam-diam
   rusak setiap kali isi skrip itu berubah. Yang benar-benar dijaga adalah
   `connect-src`: panel admin menyimpan token Supabase di localStorage, jadi
   jalur yang perlu ditutup adalah pengiriman token itu ke domain asing.
   **Kalau menambah host baru** (CDN, layanan analitik, domain media lain),
   `connect-src`/`img-src`/`script-src` harus ikut diperbarui — kalau tidak,
   permintaannya diblokir browser tanpa satu pun galat di sisi server.

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
2. **SITUS PUBLIK hanya berbahasa Indonesia.** Tidak ada pengalih bahasa dan
   tidak ada atribut `data-t`; kalimatnya ditulis langsung di markup. Kalau
   menambah halaman publik, tulis Indonesianya di tempat — jangan menghidupkan
   lagi kamus terjemahan. Portal klien (`/progres`, `/bukti`) dan halaman
   masuk admin adalah pengecualian yang sengaja: ketiganya berdiri di luar
   BaseLayout dan punya pengalihnya sendiri.
3. **SITUS PUBLIK memakai Inter — judul dan tubuh.** Diganti atas permintaan
   eksplisit pemilik supaya menyamai halaman acuannya. Judulnya berbobot
   **600** dengan `letter-spacing: -0.022em`, bukan 400/0: angka lama itu
   milik slab serif. Kalau suatu saat dikembalikan ke Arvo, kembalikan juga
   dua angka itu — Arvo sudah tebal pada reguler dan hurufnya bersinggungan
   kalau dirapatkan.

   **PANEL ADMIN masih Arvo + Maven Pro** dan sengaja belum diikutkan;
   permintaannya menyangkut tampilan situs publik. Kalau suatu saat ikut
   diganti, tautan fontnya ada di `AdminLayout.astro`.

   Aturan di bawah ini adalah setelan LAMA, disimpan karena riwayat
   penolakannya masih berlaku kalau fontnya dikembalikan:

   **Arvo untuk judul halaman; Maven Pro untuk SELURUH sisanya, termasuk
   nominal.** Dipilih pemilik sendiri lewat empat tangkapan layar DevTools.
   `--font-mono` menunjuk Maven Pro juga — itu memang permintaannya; monospace
   sungguhan (`--font-kode`) hanya untuk permukaan yang memang kode: nama token
   di `/admin/ui` dan tuts pintasan.

   Riwayatnya: Newsreader/Plus Jakarta Sans/IBM Plex Mono → Geist/Geist Mono →
   susunan ini. Yang dia tolak bukan "serif untuk judul" melainkan Newsreader-
   nya; Arvo juga serif (slab). **Geist ditolak untuk UI** — jangan kembalikan.

   Tiga hal yang wajib ikut kalau fontnya diganti lagi:

   - **Judul berbobot 400, bukan 700.** Bobot 700 dibuat untuk Geist yang
     grotesk. Arvo slab sudah tebal pada reguler dan menutup sendiri di 700.
   - **`--tracking-judul` = 0em.** Angka −0,032em juga milik Geist; kerapatan
     negatif membuat serif Arvo saling bersinggungan.
   - **Maven Pro TIDAK punya fitur `tnum`.** `font-variant-numeric:
     tabular-nums` tidak mengubah apa pun padanya. Terukur: seluruh digitnya
     sama lebar KECUALI `1`, yang 0,36px lebih sempit pada 13px — jadi kolom
     rupiah tetap sejajar dalam praktik, tapi jangan mengandalkan `tnum`.
4. **Ikon selalu SVG inline** dari `apps/web/src/components/ui/Icon.tsx`. Tanpa
   emoji, tanpa icon-font. Ikon wajib cocok maknanya dengan label di sebelahnya.
5. **Tidak ada nilai warna literal di komponen.** Semuanya menunjuk token di
   `apps/web/src/styles/tokens.css`.
6. **Tema terang bukan pembalikan otomatis.** Tiap warna semantik punya nilai
   sendiri per tema, karena amber dan hijau versi gelap pudar di atas putih.
7. **Responsif wajib**, termasuk ponsel sempit. Tidak boleh ada gulir
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

Lima hal ini pernah memakan berjam-jam. Baca sebelum menyalahkan CSS:

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
4. **`@container` diam saja kalau tidak ada leluhur ber-`container-type`.**
   Bukan galat, bukan peringatan — aturannya sekadar tidak pernah menyala,
   dan yang tampil adalah aturan dasarnya. Wadah query yang ada
   (`.buat-kartu`, `.proyek-kartu`) **tidak membungkus isi tab**, jadi setiap
   `@container` untuk `.spec-grid` di dalam tab tidak pernah berlaku. Ini yang
   membuat "Label, Kategori, Nominal sebaris" tampak selesai padahal tidak,
   dan lolos sekali dari ACC. Kalau tata letak harus benar di mana pun,
   pakai `auto-fit`/`repeat()` atau media query — jangan container query.
6. **Aturan `.topbar > *:not(...)` berkekhususan (0,2,0) — pengecualian
   per-segmen harus ditulis `.topbar > .segmen`, bukan `.segmen` saja.**
   `:not()` menyumbang kekhususan argumennya, jadi aturan umum topbar
   mengalahkan setiap aturan berkelas tunggal betapa pun ia ditulis
   belakangan. Sudah menggigit **tiga kali**: padding ponsel, `flex`, dan
   pemisah garis miring. Gejalanya selalu sama — aturannya terlihat benar di
   berkas, dan diam-diam tidak pernah menyala.

5. **Setiap stylesheet diimpor per-layout, dan `BaseLayout` cuma memuat
   `global.css` + `components.css`.** Halaman publik — termasuk `/kontak` dan
   `/progres` yang dilihat klien — tidak memuat `form.css`, `misc.css`,
   maupun `admin.css` kecuali halamannya meminta sendiri. Kelas yang dipakai
   di halaman publik harus hidup di stylesheet yang halaman itu muat; kalau
   tidak, markupnya benar tapi tampil sebagai elemen mentah bawaan browser
   tanpa satu pun galat. Sudah menggigit tiga halaman sekaligus.
   **Periksa dengan menjalankan halamannya, bukan dengan membaca komponennya.**

7. **Ikon SVG menyusut sampai 0 di dalam flex atau grid yang sempit.**
   `global.css` memberi `svg { max-width: 100%; height: auto }` supaya gambar
   tidak meluber — tapi ikon punya lebar dan tinggi eksplisit dan ikut kena.
   Di kolom Aksi yang sempit, ikon 15px jadi **0×0** dan yang tampil adalah
   tombol bulat kosong; bintang 13px jadi 5×5. Tanpa satu pun galat, dan
   tidak kelihatan dari membaca komponennya. Sudah ditutup dengan
   `svg[width][height] { flex: none; max-width: none; }` — jangan dilepas.
   Grafik tidak kena karena `<svg>`-nya memakai `viewBox` tanpa atribut
   lebar/tinggi.

8. **Menulis cache dari satu island bisa merusak hidrasi island lain.**
   `tulisCache()` ikut menyimpan PANJANG daftar di localStorage, dan panjang
   itu dibaca **saat render** oleh skeleton (`jumlahDiingat`). Sidebar hidrasi
   lebih dulu daripada isi halaman, jadi tulisan dari sidebar bisa mendarat
   sebelum panel utamanya hidrasi — server merender 6 baris, klien menghitung
   3, dan React membuang seluruh pohonnya (error #418). Kadarnya 3 dari 8 muat
   halaman, jadi mudah lolos kalau cuma dicoba sekali. Aturannya: **yang boleh
   memanggil `tulisCache(kunci, …)` hanya halaman pemilik daftar itu.**
   Pemakai lain membaca saja. Kalau curiga, ukur dengan memuat halamannya
   delapan kali dan hitung `pageerror` — bukan sekali.

9. **`onMouseEnter` di layar sentuh nyangkut selamanya.** Satu ketukan ikut
   mengirim peristiwa tetikus tiruan, lalu **tidak pernah** mengirim pasangan
   "menjauh"-nya. Sidebar yang menyembul saat di-hover jadi terbuka permanen
   menutupi halaman, dan tidak ada cara menutupnya selain memuat ulang —
   sudah terjadi di ponsel pemilik. Media query `(hover: hover)` saja tidak
   cukup: ia menyembunyikan akibatnya, bukan mencegah keadaannya. Pakai
   `onPointerEnter` lalu **periksa `e.pointerType === "mouse"`**, supaya
   keadaannya memang tidak pernah menyala.

10. **`document.fonts.check()` berbohong, dan jaringan sesi ini memutus
    fonts.googleapis.com di tengah jalan.** Fungsi itu mengembalikan `true`
    untuk keluarga yang tidak ada sama sekali — spesifikasinya menganggap
    nama yang tak dikenal sebagai font sistem. Sudah menggigit: satu putaran
    tangkapan layar dikirim sebagai bukti "Arvo termuat" padahal CSS-nya kena
    `ERR_CONNECTION_RESET` dan yang terpasang adalah Georgia. Yang
    membuktikan adalah **membandingkan lebar teks**: `Arvo` harus berbeda
    dari `serif`, `Maven Pro` harus berbeda dari `system-ui`.
    Dan supaya pratinjaunya tidak bergantung pada proxy yang labil, unduh
    CSS + woff2-nya sekali dengan `curl`, taruh di `dist/_font-uji/`, lalu
    `route.fulfill()` permintaan ke fonts.googleapis.com dengan salinan itu.

11. **Situs statis MEMBACA API saat build, dan kedua job deploy dulu jalan
    paralel.** Halaman proyek dan jurnal dibekukan dari jawaban API, jadi
    build yang jalan sebelum Worker API selesai akan memanggang data versi
    lama — atau kosong, kalau endpointnya memang belum ada. Terukur pada run
    #56: situs statis `modified_on` 02:16:01, Worker API 02:16:33, jadi
    situsnya tayang **32 detik sebelum** endpoint yang dibacanya ada.
    Gejalanya paling sulit dilacak: semuanya hijau, datanya saja tidak ada.
    Sudah ditutup dengan `needs: api` di `deploy.yml` — jangan dilepas.

12. **Kegagalan mengambil daftar proyek WAJIB menggagalkan build.** Catatan
    lama di `lib/api.ts` berbunyi "situs lama tetap tayang" — itu tidak
    benar. Workers Static Assets MENGGANTI seluruh aset, jadi build yang
    "berhasil" dengan daftar kosong menimpa situs bagus dengan situs tanpa
    satu pun proyek, dan setiap `/proyek/<slug>` yang pernah dibagikan klien
    jadi 404 tanpa satu pun langkah merah di tab Actions. `listProjects()`
    karena itu memakai `wajib()`, bukan `safely()`. Daftar KOSONG dari API
    yang menjawab benar tetap sah — yang dihentikan hanya kegagalan
    permintaannya. `listJournal()` sengaja tetap `safely()`: jurnal yang
    gagal cuma membuat satu halaman kosong.

13. **Bidik silang di sudut `.dalam` menonjol 9px keluar tepi.** Di ponsel
    `.dalam` selebar layar, jadi lengan kanannya keluar viewport dan halaman
    bisa digeser mendatar 8px. `overflow-x:hidden` di body TIDAK cukup: roda
    tetikus memang tertahan, tapi `scrollingElement.scrollLeft` masih bergeser
    — dan jari di layar sentuh mengikuti yang kedua. Ditutup dengan
    `overflow-x:clip` di `html`; `clip` dipilih karena ia tidak membuat
    penampung gulir baru, jadi `position:sticky` di dalamnya tetap hidup.
    **Ujilah dengan MENGGESER, bukan dengan membaca `scrollWidth`** — nilai
    itu tetap melaporkan lengan bidik silang yang memang sengaja menonjol.

14. **CSP `media-src` gampang terlupakan.** `img-src` dan `connect-src` sudah
    memuat domain media, tapi `media-src` sempat hanya `'self' blob:` —
    sehingga `<audio>` pesan suara klien di portal proyek ditolak peramban.
    Tanpa satu pun galat di sisi server; gejalanya cuma "suaranya tidak bisa
    diputar" di ponsel klien. Kalau menambah jenis media baru, periksa
    direktif yang sesuai, bukan cuma `connect-src`.

15. **`[hidden]` perlu ditegakkan di DUA stylesheet.** `publik.css` dan
    `global.css` melayani dua sistem yang terpisah (situs publik dan panel
    admin), jadi `[hidden]{display:none!important}` harus ada di keduanya.
    Sudah menggigit dua kali: diperbaiki di satu sisi, dan berbulan kemudian
    satu panel tab di `/admin/ui` setinggi 16.565px ketahuan masih ikut
    tergambar. Kalau salah satu berkas ditambah aturan sejenis, periksa yang
    satunya.

16. **Array JavaScript TIDAK BISA jadi parameter query.** Worker menyambung
    dengan `fetch_types: false` (wajib untuk Hyperdrive), jadi postgres.js
    tidak punya katalog tipe dan tidak bisa menyerialkan array jadi array
    literal Postgres — yang terkirim string biasa, dan Postgres menolak
    dengan `malformed array literal`. Jadi `= any(${daftar}::uuid[])`
    **selalu 500 di produksi** sementara lulus sempurna di mana pun yang
    memakai setelan postgres.js bawaan. Sudah memerahkan dua deploy
    berturut-turut dengan seluruh tes lokal hijau; situs lama selamat hanya
    karena `listProjects()` memakai `wajib()`. Bentuk yang benar:
    **`in ${sql(daftar)}`**, yang merender satu parameter per elemen.
    Dijaga `apps/api/test/parameterArray.test.ts`.

    Pelajaran yang lebih luas: **kalau menguji repository di luar Worker,
    pakai setelan koneksi yang SAMA PERSIS dengan `src/db.ts`.** Setelan
    bawaan menyembunyikan justru kelas galat yang hanya muncul di produksi.

17. **Menguji CSP dari build LOKAL memberi alarm palsu.** Build lokal
    memanggang `localhost:8787` ke dalam HTML *dan* ke dalam bundel JS.
    Dijalankan di bawah CSP produksi, keduanya jadi "pelanggaran" padahal di
    produksi alamatnya `api.*` dan `media.*` yang memang diizinkan. Petakan
    keduanya di alat uji — dan jangan lupa berkas `.js`, karena `/bukti` dan
    `/progres` mengambil datanya dari sana, bukan dari HTML.

    Sisi lain dari jebakan yang sama: **build dengan alamat produksi TIDAK
    BISA diselesaikan dari sesi ini sama sekali.** `listProjects()` memakai
    `wajib()` (jebakan #12), dan API produksi tidak bisa dihubungi, jadi
    build-nya memang gagal — bukan salah setelan. Artinya CSP produksi tidak
    bisa diuji utuh dari sini. Kalau perubahannya tidak menambah host, jenis
    aset, maupun `_headers`, katakan itu apa adanya; jangan mengaku sudah
    memeriksa CSP.

18. **Penampung yang bisa digulir MENDATAR mencuri gulir halaman.** Gerakan
    dua jari di trackpad tidak pernah lurus. Begitu ada sedikit komponen
    mendatar, peramban mengunci SELURUH gerakan itu ke penampung mendatar
    yang sedang dilewati kursor — termasuk komponen tegaknya. Halamannya
    berhenti maju sampai gerakannya habis, lalu melompat menyusul. Gejalanya
    dilaporkan pemilik sebagai "tertahan sedikit lalu jump ke bawah".

    Terukur di beranda, kursor di tengah, turun 110px serong 6px: halaman
    berhenti di scrollY 1650 dan **25 dari 40** putaran roda hilang,
    sementara galerinya bergeser sendiri 15px.

    **Ini BUKAN soal frame.** Median frame 16,7 ms di seluruh pita, dan
    mematikan animasi marquee tidak mengubah apa pun — dugaan pertama yang
    terbukti salah. Yang juga TIDAK menolong, diuji satu per satu:
    `scroll-snap: x proximity`, mematikan snap sama sekali, dan
    `overscroll-behavior-x` — ketiganya tetap 25/40 macet, karena
    penguncian terjadi sebelum snap ikut bicara. Yang menolong hanya
    handler `wheel` ber-`passive:false` yang meneruskan komponen tegaknya
    sendiri (0/40 macet). Sudah terpasang di `BaseLayout.astro` untuk
    seluruh situs publik — jangan dilepas, dan kalau menambah penampung
    mendatar baru ia otomatis ikut terlindungi.

19. **Pseudo-elemen absolut di dalam penampung gulir mendarat di ujung ISI,
    bukan di tepi tampak.** `.tabs::after{position:absolute;right:0}` pada
    bilah selebar 1037px di layar 388px mendarat di 1037 — jauh di luar
    layar, dan fade tepinya tidak pernah kelihatan. Atributnya benar,
    gambarnya tidak ada, tanpa satu pun galat. Untuk memudarkan tepi
    penampung gulir pakai `mask-image`: mask berlaku pada kotak tampaknya.

20. **Dua garis 1px yang bertetangga bukan dua garis, melainkan satu garis
    kabur.** Bilah nav berakhir di baris piksel 85 dan `.dalam` pita
    berikutnya mulai di baris 86, jadi di bawah navbar sebenarnya ada garis
    2px selebar kolom yang menipis jadi 1px di luar kolom. Terukur sama di
    lima halaman. Mematikan salah satunya bukan jawabannya: penanda sudut
    yang menunggangi garis itu tetap terpusat di baris yang lama dan jadi
    meleset satu piksel — persis yang dilihat pemilik dari zoom. Yang benar
    menggeser salah satunya supaya keduanya BERIMPIT (`.nav{margin-bottom:
    -1px}`), sehingga penandanya terpusat tepat.

21. **Membaca `scrollHeight` di dalam handler `scroll` memaksa layout tiap
    frame.** Bar kemajuan baca dulu membaca `document.body.scrollHeight`
    lalu menulis `style.width` di tiap peristiwa gulir — baca-tulis-baca
    yang menagih layout sinkron. Terukur lewat penghitung Chrome sendiri
    (CDP `Performance.getMetrics` → `LayoutCount`): **203 kali layout per
    satu lintasan gulir beranda.**

    Gejalanya khas dan menyesatkan: "gulir PERTAMA tertahan, yang kedua
    tidak". Di lintasan pertama gambarnya baru berdatangan sehingga layout
    selalu kotor dan tiap pembacaan benar-benar menata ulang halaman penuh;
    di lintasan berikutnya hasilnya sudah bisa dipakai ulang dan ongkosnya
    nyaris nol. Waktu frame TIDAK menunjukkannya — median 16,7 ms di seluruh
    pita, dan ablasi marquee/pijar/kilau/gambar sebarannya sebesar bedanya.
    **Yang menjawab `LayoutCount`, bukan waktu frame.**

    Sudah diganti bar kemajuan bertimeline gulir CSS (`animation-timeline:
    scroll()`), yang berjalan di luar main thread: 203 → 10 layout. Aturan
    turunannya: **handler `scroll` tidak boleh membaca satu pun properti
    geometri** (`scrollHeight`, `offsetTop`, `getBoundingClientRect`).
    `scrollY` aman — nilainya sudah dipegang peramban.

    **Berlaku sama untuk penampung yang digulir MENDATAR**, dan di sana ia
    sempat luput: galeri foto di beranda dan `/proyek/[slug]` membaca
    `scrollWidth`, menulis lebar bar kemajuan, lalu membaca `offsetLeft`
    sepuluh kartu — baca-tulis-baca di tengah gerakan jari. Terukur pada 60
    langkah seret: 840 pembacaan geometri dan 121 layout paksa, jadi 0
    pembacaan dan 61 layout setelah posisinya di-cache. Sisa 61 itu memang
    satu per frame, bukan paksaan.

    Keduanya sekarang memakai modul bersama supaya cacatnya tidak tumbuh
    lagi dari salinan yang menyimpang: `lib/relspy.ts` untuk penanda rel
    daftar isi (`/privasi`, `/jurnal/[slug]`, `/proyek/[slug]`) dan
    `lib/strip.ts` untuk galeri mendatar (beranda, `/proyek/[slug]`).
    Portal klien `/progres` memakai pola yang sama ditulis di tempat: 30
    pembacaan geometri per lintasan gulir jadi 0.

22. **`conic-gradient` yang beranimasi dilukis ulang tiap frame, selamanya.**
    Ia tidak bisa dikomposisi, jadi ongkosnya dibayar terus selama elemennya
    ada di halaman — bukan cuma saat dilihat. `.kilau` sekarang diam dan
    baru berputar saat disentuh kursor. Berlaku umum: animasi tak berujung
    pada gradien besar wajib punya alasan, dan hiasan bukan alasan.

23. **`backdrop-filter` pada bilah lengket adalah pemanas perangkat.** Tiap
    frame gulir compositor harus menyalin bidang di belakang bilah,
    memperkecilnya, mengaburkan dua arah, menaikkan saturasi, lalu menempel
    lagi — pada layar Retina 1440px itu ~2880x172 piksel, enam puluh kali
    sedetik selama jari masih menggeser. **Ini kerja GPU, dan TIDAK MUNCUL
    di penghitung main thread mana pun** — jadi jangan menyimpulkan ia murah
    karena `TaskDuration` tidak berubah. Sudah dibuang dari `.nav`; latarnya
    dinaikkan ke `rgba(24,24,27,.94)` dan tangkapan layar sebelum/sesudah
    tidak bisa dibedakan, karena isi di belakang bilah memang nyaris rata
    gelap. Jangan dikembalikan.

    Satu lagi ketinggalan satu putaran dan sudah ikut dibuang: bilah lengket
    `.lengket` di portal klien `/progres`, yang `position:fixed` selebar
    layar — persis bentuk yang paling mahal. Latarnya dinaikkan ke
    `rgba(9,9,11,.97)`. Kalau menambah bilah lengket baru, periksa direktif
    ini lebih dulu.

    Sekeluarga dengannya: **`mask-image` pada wadah yang isinya beranimasi
    terus** (marquee logo) memaksa lapisan itu disusun ulang tiap frame.
    Diganti dua tirai gradien statis — sama persis di mata.

24. **Latar berpola pada `body` dilukis untuk SELURUH tinggi halaman, lalu
    ditimpa.** Kisi titik di situs ini cuma terlihat di talang kiri-kanan
    dan di celah 18px antar-seksi, tapi sebagai latar `body` ia dihitung
    untuk 6.500px penuh dan ditutup habis oleh blok seksi yang buram.
    Dipindah jadi `body::before{position:fixed;inset:0;z-index:-1}` — dilukis
    sekali seukuran viewport, sisanya cuma ditempel compositor. Titiknya jadi
    diam terhadap layar; pada kisi 8px yang tiap titiknya serupa itu tidak
    terlihat.

    Dua hal yang wajib ikut, keduanya sudah menggigit sekali:
    - Warna dasar halaman harus pindah ke `<html>`. Kalau tetap di `<body>`,
      latar body menutupi pseudo-elemen ber-z-index negatif miliknya sendiri
      dan titiknya hilang sama sekali.
    - **Mode cetak harus mematikannya** (`body::before{display:none}` di
      `@media print`). Latar body putih TIDAK lagi menutupinya, jadi kisi
      titik ikut tercetak sebagai raster abu di seluruh kertas kuitansi.

25. **Animasi CSS tidak berhenti saat elemennya keluar layar.** Marquee logo
    berjalan terus selama halaman terbuka, termasuk saat pengunjung sudah
    jauh di bawah. Dijeda lewat IntersectionObserver yang menyetel KELAS,
    bukan `style.animationPlayState` — style inline mengalahkan aturan
    `:hover` yang menghentikan barisnya saat kursor masuk.

26. **Salinan teks yang diambil sekali saat muat jadi basi begitu bahasa
    ditukar.** Tiga tempat menyimpan innerHTML sebagai cadangan: teks bantuan
    form kontak (dipulihkan setelah galat validasi hilang), dan sorot
    pencarian /faq (menyimpan teks asli supaya pencarian kedua tidak menyorot
    di dalam `<mark>` sendiri). Salinan itu membeku pada bahasa yang kebetulan
    aktif saat skripnya jalan — dan sekali pengunjung menukar bahasa,
    memulihkannya menempelkan kalimat berbahasa salah yang **tidak pernah
    ditukar lagi**, karena pengalih sudah selesai bekerja. Keduanya sekarang
    diambil ulang lewat `situs:bahasa`. Indeks pencarian /faq kena hal yang
    sama: tanpa diambil ulang, mencari "uang muka" di halaman Indonesia tidak
    menemukan apa-apa karena indeksnya masih Inggris.

    Cara mengujinya yang benar: tukar bahasa DULU, baru lakukan hal yang
    memicu penulisan ulang — klik kategori, cari, kirim form kosong. Memuat
    halaman dalam bahasa Indonesia lalu memeriksanya diam-diam melewatkan
    seluruh kelas cacat ini.

27. **Membungkus teks dengan elemen baru MENGUBAH selektor keturunan dan
    `:last-child` — dan itu gejalanya jauh dari tempat yang disunting.**
    Menandai halaman untuk terjemahan berarti membungkus kalimat dengan
    `<span data-t>`, dan dua kali dalam satu putaran itu merusak sesuatu
    yang tidak ada hubungannya dengan bahasa:

    - `.ba__b span{position:absolute}` di `/studio` adalah selektor
      KETURUNAN, jadi span baru di dalamnya ikut diangkat dari alur dan
      menindih `<small>` miliknya sendiri. Ditutup dengan `> span`.
    - Jawaban `/faq` dibungkus `<div data-t>`, jadi `p:last-child` berpindah
      ke dalam div — baris "Angkanya" di luarnya kehilangan jarak atas.
      Terukur 16px jadi 0px. Ditutup dengan aturan sendiri untuk
      `.tny__angka`. Sekalian ketahuan: `margin-top:16px` miliknya di
      `publik.css` memang TIDAK PERNAH berlaku, karena Astro menempelkan
      atribut cakupan pada `.tny__b` sehingga `.tny__b :global(p)` jadi
      (0,2,1) dan mengalahkannya dengan shorthand `margin`.

    Aturannya: setiap kali menambah elemen pembungkus, cari selektor yang
    memakai `>`, `:first-child`, `:last-child`, atau nama tag di bawah
    wadah itu. Dan **ukur**, jangan lihat — yang kedua di atas tidak
    kelihatan sama sekali sekarang, karena keempat angkanya masih kosong.

28. **Server uji lokal ikut mengirim CSP produksi, dan itu memblokir foto
    uji.** `npx http-server` membaca `dist/_headers` dan menyajikannya sebagai
    header sungguhan, jadi `img-src` produksi menolak `localhost:8787` —
    alamat API yang dipanggang ke build lokal. Gejalanya menyesatkan: seluruh
    foto jadi kotak kosong bertanda gambar rusak, endpoint-nya sendiri
    membalas 200 kalau di-curl, dan tidak ada satu pun galat di konsol
    Playwright kecuali `requestfailed` dengan alasan `csp`. Ini sisi lain
    jebakan #17. Yang bekerja: sajikan `dist` dengan
    `python3 -m http.server`, yang tidak mengenal `_headers` sama sekali.
    Mencegat respons dengan `route.fulfill` untuk melepas headernya TIDAK
    bekerja — `route.fetch()` masuk ke handler-nya sendiri dan navigasinya
    menggantung sampai timeout.

**Cara mengukur ongkos gulir tanpa tertipu.** Sebaran satu kondisi di
harness ini mencapai +-45 ms, jadi membandingkan dua angka dari dua kali
jalan tidak sah — apalagi lintas sesi. Yang bekerja: jalankan kondisi LAMA
dan BARU **berselang-seling dalam satu proses**, empat putaran, lalu
bandingkan median. Dengan cara itu beda 26% terbaca bersih (501 ms lawan
371 ms per 60 putaran roda) sementara sebaran tiap kondisi tetap lebar.
Keadaan lama direkonstruksi sebagai CSS `!important` di atas build baru,
bukan dengan mem-build ulang commit lama.

## Kecepatan panel admin

Panel admin adalah situs **statis tanpa router sisi klien**: tiap klik menu
adalah muat-halaman penuh dan konteks JS mati total. Tanpa penangkal, itu
berarti sesi diperiksa ulang dan seluruh data diambil ulang setiap kali staf
berpindah halaman — bahkan kembali ke halaman yang baru saja dibuka.

Tiga hal yang menahannya, dan ketiganya harus tetap ada:

1. **Cache sessionStorage stale-while-revalidate** (`bacaCache`/`tulisCache`
   di `lib/admin.ts`). Nilai awal `useState` dibaca dari cache, permintaan
   segar tetap jalan di belakang. Setiap penulisan (metode non-GET)
   membatalkan seluruh cache — menebak kunci mana yang terpengaruh adalah
   cara paling mudah menampilkan angka basi.
2. **Profil tersimpan dipakai lebih dulu di `RequireAuth`**, dipromosikan di
   `useLayoutEffect` supaya jadi sebelum paint. Yang dipercepat cuma
   tampilannya: data tetap diambil dengan token yang divalidasi backend.
3. **Skeleton ditahan 180 ms** (`.skeleton--tunda`).

Terukur pada build sungguhan dengan latensi API 350 ms: kunjungan pertama
590 ms dengan skeleton, kunjungan berikutnya 123–167 ms **tanpa satu frame
skeleton pun**. Kalau angka itu memburuk, periksa ketiga hal di atas dulu.

Sejak gelombang berikutnya ada penahan keempat: **router sisi klien**
(`ClientRouter` di `AdminLayout`), dengan sidebar dan topbar ber-
`transition:persist`. Konsekuensinya, keduanya tidak pernah dipasang ulang —
jadi apa pun yang dulu ikut disegarkan cuma-cuma oleh muat-ulang halaman
sekarang harus diminta sendiri lewat `astro:page-load` /
`astro:before-preparation`. Yang sudah ketahuan dan sudah dipasang: penanda
menu aktif, judul di topbar, menu geser ponsel yang harus menutup, atribut
tema di `<html>`, dan overlay yang sedang terbuka. Kalau menambah sesuatu
yang bergantung pada "halaman baru dimuat", periksa daftar itu dulu.

Mengukurnya: jalankan `npm run build`, sajikan `dist` (dev server
mengompilasi per-permintaan, angkanya tidak berarti), lalu **gagalkan
permintaan ke fonts.googleapis.com** — jaringan sesi ini memblokirnya dan
permintaan yang menggantung menahan DOMContentLoaded belasan detik, angka
yang sama sekali bukan milik aplikasi.

**Dan beri latensi pada dokumen serta asetnya, bukan cuma pada API.**
Localhost punya RTT nol — keadaan yang tidak pernah dialami siapa pun, dan
yang diam-diam menguntungkan muat-ulang penuh. Terukur pada perpindahan
halaman yang datanya sudah tersimpan:

| | RTT 0 (localhost polos) | RTT 120 ms (wajar) |
| --- | --- | --- |
| Muat ulang penuh | 188 ms | 981 ms, 8 frame skeleton |
| Router sisi klien | 257 ms | **323 ms, 0 frame skeleton** |

Diukur cuma di localhost, kesimpulannya terbalik: router sisi klien tampak
memperlambat 70 ms, padahal di jaringan sungguhan ia tiga kali lebih cepat.
Selalu ukur dengan RTT.

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
| `psql "$SUPABASE_DIRECT_URL" -f supabase/tests/rls_test.sql` | 81 assertion RLS |
| `./scripts/rls-lokal.sh` | 81 assertion RLS di Postgres lokal, tanpa menyentuh produksi |
| `./scripts/build-bootstrap.sh` | Regenerate `supabase/bootstrap.sql` |
| `./scripts/setup-fase-04.sh` | Provisioning Hyperdrive + rahasia Worker API, lalu deploy |

`supabase/bootstrap.sql` **hasil generate** — ubah migrasinya, lalu jalankan
skrip; jangan sunting hasilnya.

## Cara kerja yang diharapkan

- **Branch produksi: `claude/stack-setup-supabase-cloudflare-kdwlkk`.** Push ke
  sini yang memicu deploy, jadi jangan dipakai untuk coba-coba. Kerjakan di
  branch sesi, lalu merge ke sini setelah pemilik ACC
- **Periksa `git branch --show-current` SEBELUM commit.** Setelah deploy, HEAD
  tertinggal di branch produksi — dan pekerjaan berikutnya jadi ter-commit di
  sana, menunggu ACC yang belum ada. Sudah tiga kali begitu. `git push -u
  origin <branch-kerja>` tidak menyelamatkan: ia mendorong ref branch kerja
  yang tidak berubah, lalu melapor "Everything up-to-date" seolah beres.
  Kebiasaan yang benar: `git checkout <branch-kerja>` begitu deploy selesai
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
| Tombol Terbitkan di topbar, dengan cap perubahan dari trigger database | Pemilik mengisi delapan logo klien lalu menyimpulkan fiturnya rusak; datanya benar seluruhnya, situsnya saja belum dibangun ulang. Ditaruh di topbar (bukan hanya di editor proyek) karena perubahan yang perlu diterbitkan datang dari jurnal, logo klien, info studio, dan testimoni juga. Yang dibandingkan: cap `content_revision` dari database lawan stempel build yang dipanggang ke HTML panel — panel ini hasil build yang sama dengan situs publiknya, jadi ia satu-satunya sumber yang tahu umur dirinya sendiri. Capnya lewat trigger, bukan `max(updated_at)`, karena MENGHAPUS tidak meninggalkan baris yang bisa dijumlahkan — dan menghapus foto atau menarik tulisan justru perbuatan yang paling bikin panik kalau barangnya masih tampil |
| Angka di lonceng tidak punya tombol "tandai sudah dibaca" | Dikonfirmasi pemilik. Angkanya diturunkan dari pekerjaan yang benar-benar belum ditangani (pesan belum dibaca, tenggat lewat, testimoni menunggu), jadi ia turun sendiri begitu sumbernya ditangani. Tombol tandai-dibaca butuh tabel keadaan-baca per akun, dan membuat angka bisa nol padahal pekerjaannya masih menumpuk — persis kebalikan dari gunanya |
| Tab Milestone berisi pencapaian tahap PROYEK, bukan lama berlangganan | Dikonfirmasi pemilik. Aplikasi rujukan memakai milestone anggota (1/2/3/6/12/24 bulan) karena bisnisnya berlangganan; studio arsitektur tidak punya anggota berlangganan, dan yang setara maknanya adalah tahap pipeline yang sudah dilewati sebuah proyek |
| Hono di Cloudflare Workers, bukan Go Fiber di Cloud Run | Dibalik dari keputusan sebelumnya ("Go Fiber, bukan serverless") atas permintaan eksplisit pemilik — satu platform (Cloudflare) untuk frontend, API, R2, dan DNS, tanpa akun Google Cloud terpisah. Konsekuensinya: seluruh backend ditulis ulang dari Go ke TypeScript, bukan sekadar pindah hosting |
| Hyperdrive, bukan koneksi Postgres langsung dari Worker | Worker tidak bisa membuka pool koneksi jangka panjang seperti pgxpool — Hyperdrive yang menyediakan pooling itu di sisi Cloudflare |
| Rate limit lewat KV, bukan in-memory | Worker tidak menyimpan state antar-request sama sekali, beda dari instance Cloud Run yang setidaknya bertahan selama masih hangat. KV tersebar di seluruh edge — lebih ketat dari limiter in-memory sebelumnya, dengan trade-off baca-tulis yang tidak atomik dan propagasi hingga ~60 detik. Diterima dengan alasan yang sama seperti sebelumnya: Turnstile penjaga sesungguhnya |
| Supabase di org Free terpisah | Menggabung ke `operation-gwg` (database operasional GWG yang live) akan berbagi `auth.users`, backup, dan radius kerusakan kredensial |
| Astro statis, bukan SSR | Pengunjung tidak perlu menunggu backend; Worker API boleh dingin |
| Deploy lewat GitHub Actions, bukan tangan | Deploy sebelumnya harus dijalankan pemilik dari komputer kantor, jadi kode yang sudah di-merge bisa menganggur berhari-hari — dan pernah tayang setengah jalan karena satu Worker ter-deploy dan satunya tidak. Sesi Claude tidak bisa menggantikannya karena jaringannya memblokir Cloudflare |
| Kirim pratinjau sebelum deploy, bukan deploy lalu perbaiki | Permintaan eksplisit pemilik setelah beberapa putaran perbaikan yang meleset. Yang menilai estetika adalah pemilik; memeriksa gambar jauh lebih murah baginya ketimbang memeriksa situs yang sudah tayang |
| Logo studio di R2 dengan folder `studio/`, bukan tabel terpisah | Satu kolom `logo_key` di `studio_settings` sudah cukup untuk satu logo. Folder dipisah dari `projects/` supaya berkas studio tidak ikut terhapus saat proyek dibersihkan |
| Laba bersih dihitung dari kas yang BENAR-BENAR masuk, bukan nilai kontrak | Dikonfirmasi pemilik: "uang belum diterima dengan full". Nilai kontrak adalah janji, bukan uang — proyek yang baru DP 50% akan tampak untung besar padahal setengah biayanya sudah keluar. Konsekuensinya: laba bersih sebuah proyek naik bertahap mengikuti termin pembayaran, dan baru benar setelah pelunasan |
| **Query yang gagal karena koneksi Hyperdrive putus TIDAK diulang otomatis** | Errornya `write CONNECTION_CLOSED ...hyperdrive.local:5432`, dan kata "write" itu **teks tetap** di `errors.connection()` milik postgres.js — bukan penanda operasi yang gagal. Baris pemanggilnya `!hadError && (query \|\| sent.length) && error(...)`, artinya query bisa saja SUDAH sampai dan SUDAH dijalankan saat koneksinya putus. Mengulang secara buta berarti bisa menggandakan penulisan: satu dokumen terunggah dua kali, satu tagihan tercatat dua kali. Kadarnya 3 dari 2.261 permintaan dalam 24 jam (0,13%), semuanya pembacaan, dan panel punya cache jadi sering tidak terlihat. Kalau suatu saat mau ditutup, satu-satunya cara yang aman adalah coba-ulang HANYA untuk unit kerja yang murni membaca — bukan di dalam `withDb` untuk semua pemanggil |
| Jurnal disimpan di database + ditulis dari panel admin, bukan berkas markdown di repo | Pemilik sudah mengelola proyek, klien, dan keuangan dari `/admin` setiap hari; opsi markdown mengharuskan dia menyentuh repo, yang tidak pernah dia lakukan. Ongkosnya memang lebih besar (migrasi, RLS, endpoint, satu halaman admin), tapi "yang bisa dipahami enam bulan lagi" di sini berarti yang cocok dengan cara kerjanya, bukan yang paling sedikit bagiannya |
| Isi tulisan disimpan sebagai MARKDOWN, dirender saat build | Yang mengetik pemilik sendiri, dan HTML dari isian bebas berarti tiap render harus dibersihkan lebih dulu. `@astrojs/markdown-remark` sekalian membuat id tiap heading, dan daftar isi diturunkan dari daftar heading itu — jadi id di rel kiri dan id di badan tulisan mustahil menyimpang |
| Tulisan berencana TETAP tampil di indeks, ditandai "belum ditulis" | Rancangan yang di-ACC. Mengisi indeks dengan judul palsu yang tidak bisa dibuka adalah cara tercepat kehilangan kepercayaan pembaca yang datang dari pencarian; menyembunyikannya sama sekali membuat jurnal terlihat mati. Yang berencana tidak punya tautan dan tidak dibuatkan halaman |
| Tidak ada pratinjau markdown di panel admin | Membuatnya berarti dua perender yang pasti menyimpang suatu saat — pola bug yang sudah berkali-kali memakan waktu di proyek ini. Sebagai gantinya ada petunjuk singkat di bawah kotak isian. Kalau pemilik memintanya, kerjakan dengan cara yang TIDAK menduplikasi perendernya |
| Logo klien jadi tabel + unggah di `/admin/klien`, bukan berkas di repo | Nama-namanya sempat di-hardcode sebagai teks di `lib/menunggu.ts`; pemilik sudah mengirim logonya tapi yang tayang cuma namanya, dan setiap penambahan klien berikutnya berarti mengubah kode. Sekarang dia mengurusnya sendiri, sama seperti proyek dan testimoni |
| Klien tanpa logo TETAP tampil, sebagai teks nama | Menyaringnya di API akan membuat klien yang baru didaftarkan hilang dari beranda sampai pemilik sempat mengunggah gambarnya. Karena itu `name` wajib dan `logo_key` boleh kosong — kebalikannya yang membuat baris jadi celah |
| Logo di marquee dibatasi TINGGI, bukan lebar | Logo yang lebar dan yang tinggi harus terlihat sama besar, dan yang menyamakannya tinggi optisnya. Dibuat abu dan baru berwarna saat disentuh: delapan logo berwarna sekaligus menarik perhatian lebih besar daripada karya yang ada di bawahnya |
| Thumbnail foto dibuat di BROWSER saat unggah, bukan di Worker API | Worker tidak pernah memegang berkasnya: unggahan memakai presigned URL, jadi panel meminta URL ke API lalu mengirim bytes-nya LANGSUNG ke R2. Menaruh pembuatan thumbnail di Worker berarti seluruh foto harus lewat Worker dulu — dan runtime Workers juga tidak punya kanvas untuk mendekode JPEG. Di browser, bytes-nya sudah di tangan. Ongkosnya satu decode tambahan di mesin staf saat mengunggah, ditukar dengan sepuluh decode di tiap ponsel klien yang membuka halaman proyek. Terukur pada foto 2560x1440: thumbnail 400px = 41x lebih sedikit piksel didekode, 19x lebih sedikit byte. Kolom `thumb_key` NULLABLE dengan sengaja — foto yang sudah telanjur diunggah tidak punya thumbnail dan jatuh kembali ke foto penuh |
| **Situs publik hanya berbahasa INDONESIA; sistem `data-t` DIBUANG** | Membalik keputusan terjemahan sebelumnya, atas permintaan eksplisit pemilik: "halaman ini hanya dibuat dengan bahasa indonesia saja". Yang dibuang bukan cuma tombol EN/ID — melainkan seluruh mesinnya: `lib/i18n.ts`, `lib/i18nHalaman.ts`, `lib/i18nRuntime.ts`, dan 259 atribut `data-t` di 11 berkas. Kalimat Indonesianya ditulis LANGSUNG di markup, dan itulah yang memperbaiki bug SEO yang dilaporkan pemilik: judul tab, meta description, DAN kartu bagikan sekarang Indonesia karena HTML yang disajikan server memang sudah Indonesia — bukan hasil skrip. Konversinya diskripkan, bukan disunting tangan, supaya tidak ada kalimat yang hilang; sisa bahasa Inggris dicari ulang dengan memindai `dist/**/index.html`, bukan dengan membaca berkas sumbernya. Portal klien `/progres`, `/bukti`, dan `/admin/masuk` TETAP dwibahasa — ketiganya berdiri di luar BaseLayout dengan pengalihnya sendiri, dan klien asing memang mungkin membukanya |
| Kalimat landing page diturunkan dari dokumen strategi, bukan dari tesis "klien luar negeri" | Dokumen `STRATEGI_BISNIS` milik pemilik menetapkan positioning: "studio arsitektur Pontianak yang mendesain ruang hospitality dan rumah tropis dengan pendekatan iklim khatulistiwa", dengan pasar Pontianak dan dua segmen — coffee shop sebagai mesin reputasi, rumah tinggal sebagai pilar margin. Beranda sebelumnya berdiri di atas tesis yang sama sekali berbeda (klien luar negeri, "mengirim uang lintas batas", "jarak itu soal penjadwalan"), dan dokumen itu tidak pernah menyebut klien luar negeri sebagai target. Hero, seksi portal, dan seksi "kenapa kami" ditulis ulang. Enam kompetensi di seksi "yang benar-benar kami kuasai" diambil apa adanya dari §2.2: alur bar dan dapur, ergonomi barista, akustik, pencahayaan, material tahan lembap Pontianak |
| **Harga DIUMUMKAN di beranda** — membalik sikap sebelumnya | Enam tier dari §3.1 dan §3.2 lengkap dengan rentang fee, di `lib/tier.ts`. Ini membalik jawaban FAQ lama yang berbunyi "angka sebenarnya belum diumumkan di halaman ini", dan **jawaban itu sudah ikut diubah** — dua tempat yang menyebut harga harus selalu sepakat, kalau tidak yang membaca berhenti percaya keduanya. Yang TETAP tidak diumumkan dan tetap bertanda "ditanyakan": persentase uang muka, lama tiap tahap, dan jadwal kunjungan lokasi; ketiganya memang berubah per proyek dan dokumen strategi tidak menetapkannya. Kalau harga naik (aturannya di §3.3: tiap 3 proyek selesai pada satu tier, naik 10–15% untuk klien baru), yang diubah cuma `lib/tier.ts` |
| **`.btn--dot` = kotak GELAP bergaris teal, bukan tombol teal pejal** | Membalik bentuk sebelumnya (latar teal, titik gelap), yang ditolak pemilik dengan acuan tombol "Sign up for free" refine.dev: latar gelap, garis teal, teks teal, tekstur titik teal. Bentuk yang sama dipakai tiga tempat supaya satu bahasa visual untuk "ini aksi utama / ini tujuannya": tombol nav, lencana pembuka hero (`.hero-lencana`), dan tab tarif yang sedang aktif. Kalau salah satunya diubah, ketiganya harus ikut. Tombol navbar tetap RECTANGLE, bukan pil |
| Judul tab dan meta description ikut bahasa; kartu bagikan TIDAK | Dilaporkan pemilik sebagai bug SEO: isi halaman sudah Indonesia, judul tab masih Inggris. Diperbaiki lewat dua kunci khusus `metaJudul` dan `metaKet` di tiap kamus halaman, dibaca pengalih bahasa — bukan `data-t`, karena keduanya tinggal di `<head>`. Yang **tidak bisa** diperbaiki dengan cara ini: kartu bagikan WhatsApp/Twitter membaca HTML yang DISAJIKAN server, bukan hasil skrip, jadi kartunya selalu versi Inggris. Menukarnya butuh rute `/id` terpisah — yang sudah ditolak karena dua berkas berisi kalimat yang sama pasti menyimpang |
| **Positioning NASIONAL, bukan Pontianak saja** | Permintaan eksplisit pemilik: "jangan buat ini patokan di pontianak aja tapi ini untuk 1 indonesia". Ini BERBEDA dari dokumen strategi, yang seluruhnya menganalisis pasar Pontianak — jadi kalau suatu saat ada yang membandingkan situs dengan PDF-nya, perbedaannya memang sengaja dan pemilik yang memutuskan. Pontianak tetap disebut sebagai tempat studio berkantor (dan itu yang menjelaskan keahlian iklim lembapnya), bukan sebagai batas layanan. Yang ikut berubah: eyebrow hero, kalimat material, meta description tiap halaman, dan satu catatan di kaki seksi tarif tentang biaya perjalanan |
| Pindah urutan menukar `sort_order` dua tetangga, bukan menulis ulang daftar | Dua permintaan alih-alih delapan, dan urutan yang lain tidak ikut berubah kalau salah satunya gagal |
