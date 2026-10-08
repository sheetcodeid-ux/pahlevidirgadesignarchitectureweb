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
   Di panel kit: `components/kit/ikon/` — 179 bentuk Coinest ditambah 39 ikon
   ARSITEKTUR yang digambar sendiri dari benda studio (`arsitektur.ts`, dipakai
   rel samping, kepala halaman, palet, dan panel kepala). Larangan "menggambar ulang ikon dari tangkapan
   layar" di bagian Figma tetap berlaku: yang dilarang menjiplak ikon Coinest,
   bukan menggambar bentuk baru yang memang milik studio.
5. **Tidak ada nilai warna literal di komponen.** Semuanya menunjuk token di
   `apps/web/src/styles/tokens.css`.
6. **Tema terang bukan pembalikan otomatis.** Tiap warna semantik punya nilai
   sendiri per tema, karena amber dan hijau versi gelap pudar di atas putih.
7. **Responsif wajib**, termasuk ponsel sempit. Tidak boleh ada gulir
   horizontal pada badan halaman.

### Selera pemilik — patokan untuk SETIAP halaman berikutnya

Ditetapkan pemilik sendiri setelah halaman Akun di-ACC (5 Okt 2026):
"ini dia selera saya … ini paling mantap … tahap selanjutnya kamu sudah
tahu apa yang saya inginkan, menyesuaikan kebutuhan halamannya". Sebelum
itu ada dua penolakan yang sama pentingnya — keduanya tercatat di bawah.

Yang DIA MAU:

1. **Tiap halaman tampil sebagai JENIS halamannya sendiri**, versi premium.
   Akun = halaman profil; pengaturan = halaman pengaturan. Bukan formulir
   polos (versi lama Akun dinilai "0"), dan bukan salinan Dashboard.
2. **Kreatif lewat tema yang hanya dimiliki studio arsitektur** — tapi
   BENTUKNYA diturunkan dari pekerjaan halaman itu, bukan dari halaman
   lain. Lembar gambar kerja (kertas kalkir, denah garis, sumbu grid
   berbulatan bergaris titik-strip, panah utara, kop lembar) adalah bentuk
   halaman IDENTITAS — Akun dan Info Studio — dan berhenti di situ. Halaman
   aturan berbentuk aturan (pasal + hitungan), halaman daftar berbentuk
   daftar, dan seterusnya.
3. **Hiasan selalu membawa data sungguhan.** Kop lembar di sampul Akun
   memuat peran, sesi aktif, terakhir masuk — bukan teks karangan.
4. **Kerangka yang di-ACC UNTUK HALAMAN IDENTITAS** (Akun, Info Studio):
   kepala bersampul selebar halaman → identitas besar (avatar/logo
   menumpang di tepi sampul) → tombol pintas → tab bergaris bawah (ARIA
   penuh, panah/Home/End, disimpan di hash) → satu panel per tab. Satu tab
   satu pekerjaan. Kerangka ini BUKAN templat halaman lain — lihat
   penolakan ketiga di bawah.
5. **Satu benda yang menyenangkan disentuh per halaman** — kartu staf yang
   miring mengikuti tetikus, gambar garis perangkat, pratinjau tema yang
   dibelah miring. Geraknya hanya saat disentuh, tetikus saja (jebakan
   #9), diam kalau `prefers-reduced-motion`.
6. **Pratinjau yang ikut berubah saat diketik** dan memperlihatkan tempat
   data itu benar-benar muncul (kartu staf ikut nama yang diketik).
7. **Bahannya tetap kit**: kartu putih r16 garis 1px, ubin mint, Isian/
   Tombol/Lencana kit, token warna, hijau tua pejal (`--kas-bidang`) untuk
   bidang identitas. Aturan warna, kontras kedua tema, dan satu layar
   (0 gulir dokumen, area isi, DAN panel pada 1440x790 & 1366x768) tetap
   berlaku.
8. **Metafora benda nyata yang UTUH, bukan hiasan bertema.** Disahkan
   pemilik sesudah Buku Gaji di-ACC (6 Okt 2026): "nah gini kamu sudah tau
   selera saya". Yang membuatnya diterima bukan tiap detailnya, melainkan
   halamannya BERPERILAKU seperti bendanya: buku gaji punya sampul kulit
   berjahit, rak jilid per tahun, pita pembatas di bulan berjalan, lembar
   kertas buku besar bergaris kolom, indeks bulan di tepi yang sekaligus
   grafik, cap DITERIMA/LUNAS, halaman depan rekapitulasi, dan HALAMANNYA
   DIBALIK saat pindah bulan (panah papan ketik juga membalik). Tiap bagian
   tetap membawa data sungguhan (butir 3) — panjang tab = jumlah bulan itu,
   tinggi buku di rak = jumlah tahun itu.
9. **"Tingkatkan 1000x" = PANDANGAN PERTAMA dan GERAK, bukan detail kecil.**
   Putaran yang cuma menambah detail halus (jahitan, takik, foil) dibalas
   "kenapa masih biasa aja" — detail sekecil itu tidak terbaca dari
   tangkapan layar. Yang diterima adalah perubahan yang langsung terlihat
   (kertas buku besar, judul besar, tumpukan lembar) DAN gerak yang hidup
   (balik halaman). Permintaan naik berturut-turut itu wajar dan akan
   datang lagi; tiap putaran harus mengubah kesan pertama, bukan
   menumpuk di pinggir. **Kalau ada gerak, kirim VIDEO** (Playwright
   `recordVideo`) di samping tangkapan layar — gambar diam tidak bisa
   menunjukkan balik halaman.
10. **"Kebebasan penuh" tetap di dalam metaforanya.** Saat diberi kebebasan
    tanpa batas, yang di-ACC adalah memperdalam benda yang sama (halaman
    depan rekap di dalam buku yang sama, dibuka dari tab dan dari rak),
    bukan pindah ke konsep baru atau menambah fitur.
11. **Bendanya dari DUNIA ARSITEKTUR, bukan benda umum yang kebetulan
    cocok dengan judulnya.** Disahkan lewat Keuangan — Ringkasan (ACC
    7 Okt 2026, "acc save memory yang saya acc"): sesudah timbangan (dua
    putaran) dan papan bursa ditolak, pemilik menegaskan "yang berkaitan
    dengan architecture", dan yang diterima adalah dokumen yang memang
    dipakai studio/konstruksi untuk urusan di judulnya — lembar KURVA S +
    REKAPITULASI RAB di papan gambar. Pertanyaannya jadi dua: "benda apa
    halaman ini di dunia nyata?" DAN "benda itu milik dunia arsitektur?".
    Kalau dua putaran pada benda yang sama ditolak, cari benda lain —
    jangan putaran ketiga.
12. **Rapi, bukan "kerajinan tangan".** Penempel sembarangan (selotip
    miring di sudut kertas) dinilai "berantakan, jelek". Lembar ditampilkan
    seperti dokumen cetak: bingkai cetak ganda, tumpukan lembar yang lurus,
    tanpa benda tempelan. Yang membuat putaran "100000000x" Ringkasan
    di-ACC: bidang berwarna di bawah kurva, angka besar yang ringkas (blok
    laba + neraca batang), data yang muncul saat DISENTUH (kurva S per
    proyek), dan angka yang BERHITUNG saat pilihan berganti — semuanya di
    dalam benda yang sama.
13. **Dashboard = dashboard SUNGGUHAN berbahasa kantor arsitek, bukan
    gambar bermetafora.** Di-ACC 8 Okt 2026 sesudah frame 01 yang ditambal
    dan tampak kawasan ditolak: kop gambar bernomor berisi angka bulan ini,
    jadwal induk (time schedule) proyek berjalan, arus kas, agenda. Dua hal
    yang membuatnya diterima: rancangannya DITANYAKAN DULU lewat dua sketsa
    ASCII sebelum dibangun, dan putaran naiknya memperdalam benda yang sama
    lewat data yang bisa disentuh (bulan yang dibaca kop, mode fokus, sorot
    silang agenda↔jadwal) — bukan menambah panel.

Yang DITOLAK:

- **Desain bebas yang meninggalkan bahasa kit** — Dashboard "malah makin
  jelek yaa"; yang diterima justru frame 01-nya.
- **Menyalin susunan Dashboard ke halaman lain** — Akun versi tiga kolom
  dengan kartu hijau ala kartu kas dan cincin: "yang benar aja lu semua lu
  mau samakan dengan dashboard … creative tapi jangan juga, layaknya akun
  aja tapi versi upgrade".
- **Menumpuk fitur untuk terlihat "lebih"** — ketika ditanya "100x lipat",
  yang dia maksud tampilannya, bukan fitur baru.
- **Menyalin kerangka lembar Akun/Info Studio ke halaman lain** — Aturan Fee
  Tim sempat dibangun dengan sampul, kop lembar, stempel, dan tab yang sama
  persis (cuma gambar sampulnya diganti potongan A–A): "kamu masih aja
  nggak paham yaa? jangan disamakan semuaaaa … jika aturan fee maka
  tampilannya aturan fee bukan disamakan seperti akun dan studio, hancur
  web saya kalau kamu mempunyai pola pikir seperti itu". Yang dipakai ulang
  antarhalaman hanyalah BAHAN kit (butir 7) dan SIKAPNYA (butir 3, 5, 6) —
  bukan susunannya. Sebelum membangun, tanyakan "benda apa halaman ini di
  dunia nyata?" (buku aturan, buku kas, papan tugas, map proyek) dan
  turunkan susunannya dari jawaban itu.
- **Benda keuangan umum untuk halaman ringkasan** — timbangan neraca ("masih
  biasa aja … harus BEDA, bukan timbangan") dan papan kurs split-flap ("jauh
  lebih buruk dari yang saya kira"). Keduanya cocok dengan kata "ringkasan
  keuangan", tapi bukan milik dunia arsitektur (lihat butir 11).
- **Selotip/tempelan di sudut kertas** — "jangan ada tape kyk gitu itu buat
  jadi berantakan jelek".
- **Dashboard sebagai gambar bermetafora** — tampak kawasan (proyek digambar
  sebagai bangunan berlantai termin) dinilai "jelek banget". Untuk Dashboard
  yang dimau dashboard SUNGGUHAN versi pro dengan bahasa kantor arsitek
  (kop gambar, jadwal induk, agenda), dan rancangannya ditanyakan dulu.
- **Benda yang tidak berkaitan dengan JUDUL halaman, dan 3D menyeluruh** —
  Fee Proyek sempat jadi lemari laci gambar berperabot 3D utuh (gulungan,
  plat logam, laci yang ditarik). Di-ACC sekali, lalu ditanya balik:
  "kenapa harus laci? … boleh 3d tapi jangan keseluruhan, patokannya ada di
  gaji", dan "yang berkaitan dengan fee proyek, setiap membuat harus sesuai
  dengan judul". Laci gambar memang benda studio, tapi bukan benda FEE.
  Jawabannya harus benda yang memang dipakai untuk urusan di judulnya
  (fee dibayar → kuitansi), dan bahasanya bahasa Buku Gaji: papan datar +
  kertas, dengan 3D hanya di SATU momen gerak.

**Halaman UI Component (`/admin/kit`) adalah satu-satunya sumber kebenaran
komponen panel.** Hanya master admin yang bisa membukanya. Isinya **62
komponen dalam 8 folder** (Aksi, Formulir, Overlay, Navigasi, Data, Umpan
Balik, Tata Letak, Percakapan) plus folder Ikon; daftarnya
`components/kit/galeri/katalog.tsx`, demonya `demoSatu.tsx`/`demoDua.tsx`.
Saat membangun fitur baru, ambil komponen dari sana — jangan membuat komponen
baru kecuali diminta, dan kalau membuat, daftarkan ke katalog itu. Perbandingan
dengan frame Figma SENGAJA dibuang dari halaman ini atas permintaan pemilik:
komponen yang sudah jadi kini acuannya sendiri.

"Dipakai di" pada tiap komponen dihitung saat BUILD oleh
`pages/admin/kit.astro` dari rantai impor sumbernya — bukan ditulis tangan.
59 dari 62 terpakai; tiga sisanya (Input OTP, Direction, Questionnaire)
sengaja belum, dengan alasannya tertulis di `BELUM_DIPAKAI` di `Galeri.tsx`.
Jangan menempelkannya paksa ke halaman yang tidak membutuhkannya.

`/admin/ui` (sistem lama, 64 komponen, `docs/design-system.md`) masih bisa
dibuka lewat alamatnya tapi tidak lagi jadi acuan.

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

Untuk ukuran huruf, cara yang paling tepat: **tukar kalimat acuannya masuk ke
halaman, lalu bandingkan lebar tintanya.** `GANTI=berkas.json node
scripts/banding/widget.mjs …` menukar isi elemen dengan kalimat acuan
("$415,000", "Finance Quality") sebelum dipotret, dan `scripts/banding/pita.mjs`
membaca pita tinta per baris kedua gambar. Dengan kalimat yang sama, rasio
lebar = rasio ukuran huruf: 110,5 lawan 94,5 berarti 28px seharusnya 24px.
Menebak dari tinggi tinta atau dari mata meleset 2–4px berkali-kali di frame
04 — "Today" terbaca 16px padahal 14, isi tabel 12px padahal 10.

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

   Saudaranya: `height: auto` dari aturan yang sama membuat ikon di dalam
   flex ber-`align-items: stretch` (bawaan) **meregang setinggi induknya**.
   Ikon 24px di bidang gelap kartu piutang tergambar 24x66 dan tintanya
   turun ke tengah bidang. Wadah flex yang memuat ikon perlu
   `align-items` selain `stretch`.

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

29. **Selektor tetangga (`+`) tidak peduli `display:none`.** Elemen yang
    disembunyikan CSS TETAP saudara di DOM, jadi `.a + *` tetap mencocok
    lewatnya. Sudah menggigit di topbar: aturan untuk mematikan garis miring
    sesudah ruang pendorong — yang cuma muncul di bawah 71rem — ikut
    mematikan garis miring tombol Terbitkan pada 1440px, tempat pendorongnya
    `display:none`. Tidak kelihatan dari membaca CSS-nya; yang menjawab
    hanya menghitung garis miring yang benar-benar tergambar di beberapa
    lebar. Aturan yang bergantung pada elemen yang kadang disembunyikan
    HARUS ditulis di dalam media query yang menampilkannya.

30. **Vitest menerima impor yang ditolak `tsc`, jadi tes hijau tidak berarti
    typecheck hijau.** Dua bentuk yang lolos vitest dan merah di `tsc`:
    impor berakhiran `.ts` (TS5097), dan modul Node seperti `node:fs` yang
    memang TIDAK diberi tipe di `apps/api/tsconfig.json` — `types` di situ
    sengaja cuma workers-types + vitest, supaya kode Worker tidak bisa
    menyentuh API Node tanpa ketahuan. Jangan menambal dengan `@types/node`:
    itu membuka pintunya untuk SELURUH `src`. Yang benar satu berkas
    deklarasi kecil di `test/` berisi fungsi yang memang dipakai. Dan
    **jalankan `npm run typecheck` sebelum push ke branch produksi** — di
    repo ini typecheck adalah langkah CI, jadi yang merah bukan cuma
    lapornya melainkan seluruh deploy-nya.

    Sekalian dua hal yang ikut ketahuan di berkas yang sama: path absolut
    `/home/user/...` mengikat tes ke satu mesin (pakai
    `new URL(p, import.meta.url)`), dan `pkill` yang dirangkai dalam satu
    perintah Bash majemuk membunuh shell-nya sendiri (exit 144) — jalankan
    lewat `bash skrip.sh` atau `sh -c`.

31. **Prop yang kelasnya tidak punya aturan CSS gagal DIAM-DIAM.** `Avatar`
    menerima `size="sm" | "md" | "lg"` dan menempelkan `.avatar--sm` /
    `.avatar--lg` dengan patuh — tapi kedua kelas itu tidak pernah ada di
    stylesheet mana pun. Jadi sembilan pemanggil yang minta "sm" dan satu
    yang minta "lg" semuanya tergambar 2,5rem, dan yang paling kelihatan
    avatar di bilah atas: 40px di dalam bilah setinggi 52px, yang dilaporkan
    pemilik sebagai "avatar terlalu besar". Tidak ada galat, tidak ada
    peringatan, dan membaca komponennya tidak menunjukkan apa pun — yang
    menjawab cuma `grep` nama kelasnya di `styles/`. Kalau menambah prop
    varian, buktikan kelasnya benar-benar punya aturan.

32. **Dua daftar berisi hal yang sama pasti menyimpang; yang jarang dilihat
    yang salah.** Sidebar dan command palette masing-masing punya daftar
    halamannya sendiri. Palet menawarkan "Analisis Bulanan" ke
    `/admin/keuangan/bulanan` yang **halamannya tidak ada** — 404 — sementara
    sembilan halaman sungguhan (Fee Proyek, Gaji, Jurnal, Akun, dan enam
    halaman Situs Publik) tidak pernah bisa dicari dari palet sama sekali.
    Sekarang keduanya membaca `lib/navAdmin.ts`.

33. **Lebar flex item TIDAK dibatasi induknya kalau induknya
    `align-items: flex-start`.** Anak jadi seukuran max-content dan cuma
    dibatasi `max-width` sendiri, jadi ia meluber keluar induk tanpa pernah
    memicu `text-overflow: ellipsis`. Di bilah atas itu berarti nama studio
    mendorong halaman 33px ke kanan pada 1024px. Dan `flex-shrink: 1` pada
    induknya tidak menolong tanpa `min-width: 0` — ukuran min-content sebuah
    flex item adalah lebar isinya. Dua hal itu harus ada berdua:
    `min-width: 0` di item yang boleh menyusut, `align-self: stretch` di
    teks yang harus memendek.

34. **Chromium membulatkan lebar-maju TIAP GLIF ke piksel bulat; alat
    desain tidak.** Terukur pada "Button" berbobot 600 di Urbanist: 31,000
    pada 10px lawan 28,800 yang seharusnya. Jadi setiap kotak yang MEMELUK
    teksnya — tombol, lencana, keping, tab — tergambar sampai 2,2px lebih
    lebar daripada rancangannya, dan selisih itu tidak pernah bisa ditutup
    dengan padding karena besarnya berubah menurut ukuran font dan panjang
    kalimat. Penawarnya `text-rendering: geometricPrecision`, yang
    menghidupkan penempatan sub-piksel: 28,875 / 34,656 / 40,422 pada
    10/12/14px, meleset 0,08px dari angka rancangannya. Dipasang di
    `kit.css` saja, yang cuma dimuat halaman kit — jangan dinaikkan ke
    `global.css` tanpa mengukur ulang seluruh panel admin lama.

35. **Kotak sebuah GRUP teks adalah kotak baris TERPANJANGNYA, bukan baris
    pertamanya.** Sudah menggigit telak: tinta `Title_10` di frame Figma
    255,87 lebar saya baca sebagai lebar baris pertama, lalu ukuran
    fontnya dinaikkan jadi 16px supaya cocok — padahal itu kotak gabungan
    TIGA baris dan ukuran sebenarnya 12,5px. Teksnya tergambar 28%
    kebesaran, dan tidak ada satu pun angka di CSS-nya yang terlihat
    salah. Yang membuktikannya memecah path teks yang sudah di-outline
    pada tiap perintah `M` lalu mengelompokkannya menurut pusat-y —
    hasilnya 188,14 / 235,79 / 73,75, dan yang 235 itu baris KEDUA.

36. **Alat ukur yang buta pada satu properti akan selalu menyalahkan
    komponen yang benar.** Sudah enam kali di proyek ini, dan tiap kali
    gejalanya sama: angkanya merah, komponennya tidak apa-apa. Yang sudah
    kejadian — membaca `borderTopColor` saja padahal barisnya cuma
    bergaris bawah; tidak membaca `stroke` SVG sama sekali; menumpuk dua
    gambar dari pojok kiri-atas padahal ekspor Figma dipotong pada TINTA;
    memaksakan geseran tinta pada gambar yang piksel teratasnya bukan
    benda yang sama; membandingkan warna sama-persis sehingga #EEEEEF
    lawan #EFF0F0 terbaca "hilang"; dan menghitung porsi warna terhadap
    seluruh sel termasuk latar putihnya, sehingga dua gambar yang piksel
    demi pikselnya identik terbaca 25,4% lawan 40,9%. Aturannya:
    **sebelum memperbaiki komponen karena angka, buktikan dulu alatnya
    melihat apa yang Anda kira ia lihat** — biasanya dengan menumpuk
    gambarnya dan melihat sendiri.

37. **Dua token yang BERBEDA di tema terang bisa bernilai SAMA di tema
    gelap.** `--brand` #1E4841 dan `--brand-mint` #BBF49C jelas berbeda di
    terang; di gelap keduanya #BBF49C, karena di sana mint memang warna aksi
    dan hijau tua jadi warna bidang. Jadi `background: var(--brand); color:
    var(--brand-mint)` — yang benar dan terukur di terang — menggambar mint
    di atas mint begitu temanya ditukar: kotaknya ada, teksnya hilang sama
    sekali. Terukur: rasio kontras 1,00. Sudah menggigit di lencana pejal,
    yang dipakai di setiap tabel berstatus, dan lolos berbulan-bulan karena
    galeri kit dan seluruh pengukuran banding dijalankan dalam tema terang
    saja. Aturannya: **setiap pasangan latar-dan-tinta yang dirakit dari dua
    token berbeda harus dilihat di KEDUA tema**, dan yang membuktikan rasio
    kontras yang dihitung dari `getComputedStyle`, bukan tangkapan layar —
    mint di atas mint tetap terbaca sebagai "ada kotaknya" oleh mata yang
    sedang mencari hal lain.

    Alatnya sudah ada: `node scripts/banding/kontras.mjs <jalur halaman…>`
    memindai tiap elemen yang menggambar teks di atas latarnya sendiri, di
    KEDUA tema, dan melaporkan yang di bawah rasio 3. Ia langsung menemukan
    dua cacat lagi yang tidak kelihatan dari melihat: lencana tren
    (`.k-trenlebar`) mint-di-atas-mint pada 1,00, dan inisial proyek di ubin
    transfer putih-di-atas-mint pada 1,23. Yang tersisa di bawah 3 setelah
    itu cuma pasangan merah-di-atas-merah-muda (#F73541 pada #FDCED1, 2,69)
    yang memang warna Coinest sendiri — dibiarkan karena mengubahnya berarti
    menyimpang dari framenya, dan itu keputusan pemilik.

    **Alat itu sendiri sempat buta satu kelas (jebakan #36).** Ia cuma
    memeriksa elemen yang SEKALIGUS punya teks langsung dan latar sendiri,
    jadi teks yang latarnya milik LELUHUR — label `<span>` di dalam pil
    `<a>` bermint — tidak pernah diperiksa. Sekarang latar dicari ke leluhur
    buram terdekat, dan tiga cacat tema gelap langsung ketahuan, semuanya
    lolos berbulan-bulan: menu aktif rel kit putih-di-atas-mint (1,23),
    kategori kartu proyek hijau-di-atas-hijau-yang-sama (1,00), dan label
    "Terbit" kartu kas (1,4) — ditambah satu buatan saya sendiri di halaman
    Fee: kolom "Tanpa nama" bertinta amber di atas putih (1,91), yang kini
    membawa amber-nya lewat titik. Temuan baru yang SENGAJA dibiarkan karena warna
    frame: abu `#BCBEBD` di atas putih (1,87) pada tautan kaki halaman dan
    tanda "—" — tautan kaki di SVG framenya memang `#BCBEBD`. `<option>`
    dilewati: ia digambar menu sistem operasi, bukan halaman.

    **Ia juga sempat buta pada IKON.** Yang diperiksa cuma simpul teks, jadi
    ikon SVG terang di atas ubin mint tema gelap (1,23) lolos di lima tempat
    — linimasa kit (`BarisLog`), ubin transaksi, ubin tagihan, ubin penyedia,
    dan pemilih proyek Catat Pengeluaran. Sekarang `<svg>` berlebar-tinggi
    ikut diperiksa (warnanya `color` miliknya, karena ikon kit menggambar
    dengan `currentColor`), dan kelimanya sudah diperbaiki dengan penimpa
    khusus tema gelap — tema terang terbukti identik piksel demi piksel.
    Sisa ikon di bawah 3 yang dibiarkan: warna frame (bintang inbox abu dan
    amber, lencana tren merah-muda) dan panah paginasi yang memang mati.

    **Ia juga sempat buta pada `color(srgb …)` dan pada tinta TEMBUS.**
    `getComputedStyle` mengembalikan hasil `color-mix()` sebagai
    `color(srgb r g b / a)` berskala 0–1, yang dibaca seolah 0–255 — latar
    hijau campuran terbaca nyaris hitam dan 50 pasangan di Aturan Fee
    dilaporkan 1,00–2,05 padahal semuanya di atas 4. Sekarang dua bentuk itu
    dibedakan, dan tinta beralfa dicampur dulu dengan latarnya. Alatnya
    terbukti masih menangkap pasangan merah-di-merah-muda 2,69 di Dashboard.

    **Dan ia buta pada keadaan HOVER.** `.k-tombol--secondary:hover` melukis
    latar `--brand-mint` di bawah tinta `--brand` — di tema gelap keduanya
    #BBF49C, jadi SETIAP tombol sekunder kit kehilangan teksnya selama
    kursor ada di atasnya. Ketahuan dari tangkapan layar sesudah klik, bukan
    dari alat. Sudah ditimpa khusus tema gelap; kalau menambah varian dengan
    hover, ukur warnanya sambil `hover()`.

38. **Memindahkan halaman ke kerangka baru bisa MENGHAPUS FITUR tanpa satu
    pun galat.** Selama rombak ke kit, delapan hal hilang dari produksi dan
    tidak ada satu pun langkah merah: tombol **Keluar** (satu-satunya ada di
    Topbar lama; halaman terakhir yang memakainya pindah di run #134 — panel
    sempat tanpa jalan keluar sama sekali), palet **Ctrl/Cmd+K**, **lonceng**
    berangka, tombol **Pesan**, **angka merah** Pesan Masuk di rel, baris
    **UI Component** untuk master, dialog **bukti pembayaran** untuk klien,
    dan dua **PDF** berkop (Rincian Biaya, Daftar Tagihan). Polanya selalu
    sama: fiturnya tinggal di komponen LAMA yang tidak lagi dipasang halaman
    mana pun, atau kerangka barunya menggambar kontrolnya dari frame tanpa
    menyambungkannya — kotak cari, lonceng, dan tombol pesan di kepala kit
    cuma hiasan sejak hari pertama.

    Yang menemukannya bukan membaca halaman melainkan audit mekanis, dan
    itu yang wajib diulang tiap kali satu kelompok halaman pindah:
    - **fungsi API tanpa pemanggil** — tiap fungsi yang diekspor
      `lib/admin.ts` tapi tidak dipanggil komponen hidup mana pun adalah
      fitur yang tidak bisa dijangkau (di sini: `daftarInvoice`,
      `daftarBiaya`, `ambilLogoStudio` → PDF);
    - **berkas tanpa pengimpor** — `PaymentFlow.tsx`, `lib/pdf.ts`;
    - **kontrol tanpa handler** di kerangka — `onClick`/`href` kosong;
    - **prop layout yang tidak dioper** — `RelKit` menerima
      `pesanBelumDibaca` dan `master`, `KitLayout` tidak pernah mengisinya.

39. **Fokus yang dikembalikan ke tombol yang sudah LENYAP jatuh ke
    `<body>`.** Dialog konfirmasi Radix mengembalikan fokus ke pemicunya —
    tapi pemicu tombol hapus adalah milik kartu yang baru dihapus. Di daftar
    berkartu (kunci id) kartunya lenyap begitu daftar digambar ulang, dan
    pemakai papan ketik terlempar ke awal halaman tanpa tanda apa pun.
    Terukur di Catat Pengeluaran, Logo Klien, dan Tim Studio; tabel kit
    tidak kena karena barisnya berkunci URUTAN, jadi tombolnya dipakai ulang
    untuk baris berikutnya. Penangkalnya `lib/fokus.ts`
    (`jagaFokusSesudahHapus`), dipakai `HapusBaris` dan dialog biaya. Tiga
    hal yang masing-masing sempat membuatnya gagal:
    - janji "sudah dihapus" selesai saat state DISETEL, belum digambar —
      `isConnected` masih true;
    - Radix baru mengembalikan fokus SESUDAH animasi tutup dialognya, dan
      perangkap fokusnya menarik balik fokus yang dipindah lebih awal — jadi
      ditunggu sampai tidak ada `[role=dialog]` lagi;
    - kontrol cadangannya bisa MATI sesudah digambar ulang ("geser ke kiri"
      kartu yang naik ke urutan pertama jadi `disabled`), jadi yang difokus
      kontrol hidup pertama mulai dari cadangan itu.
    Mengujinya: tekan Enter di tombol hapus lewat PAPAN KETIK, lalu baca
    `document.activeElement` — klik tetikus menyembunyikan seluruh kelas ini.

40. **`toast()` tepat sebelum `navigate()` tidak pernah terlihat.** Toast
    hidup di island halaman, dan pindah halaman membuang island itu sebelum
    toastnya sempat tergambar. Lima alur berakhir di halaman lain tanpa satu
    kata pun bahwa perbuatannya berhasil: hapus proyek (yang malah memakai
    `location.href`, muat ulang penuh), hapus tulisan, hapus paket, tambah
    tulisan, tambah paket. Pakai `titipToast()` dari `kit/Toast` —
    pesannya dititipkan di sessionStorage dan dijemput SEKALI oleh
    `<TitipanToast/>` di kepala halaman kit, berumur 15 detik. Dan jangan
    pindah lewat halaman yang mengalihkan sendiri (`/admin/proyek/edit`):
    halaman perantara itu ikut menjemput titipannya lalu membuangnya.

41. **Rel samping dan titik-patah halaman kit SATU paket.** Seluruh
    titik-patah halaman kit (1240, 1360, 1200, 1100, 1000, 60rem) dirancang
    untuk rel 192. Melebarkan rel ke 240 tanpa menggesernya membuat halaman
    bertata-letak desktop di kolom 48px lebih sempit dari yang pernah diuji
    — "Tambah tugas" keluar kartunya 21px pada 1280, dan 11 tabel harus
    digeser di dalam kartunya pada 1440. Semuanya digeser +48 (1288, 1408,
    1248, 1148, 1048, 63rem), menu geser naik dari 40rem ke 56rem, dan kolom
    tabel kit jadi PERSEN dari jumlah lebar frame dengan lantai 94% di
    desktop. **Kalau lebar rel diubah lagi, geser semuanya sebesar
    selisihnya** — catatannya di `.kl` di `KitLayout.astro`. Buktinya: build
    baru dengan rel dipaksa 192 identik dengan produksi kecuali pergeseran
    sub-piksel anti-alias.

42. **Daftar dari API tidak memuat isi tulisan — dan satu saringan membuang
    SELURUH halaman jurnal.** `/api/v1/journal` membalas `null as body`
    (sengaja: daftar tidak perlu isi), sementara `getStaticPaths` di
    `jurnal/[slug].astro` menyaring tulisan berisi kosong. Hasilnya tidak
    SATU PUN halaman tulisan pernah dibangun: indeks jurnal menautkan ke
    404, tanpa satu langkah merah pun. Sekarang tiap kandidat diambil utuh
    lewat `getJournal(slug)` (memakai `wajib()`) sebelum disaring. Yang
    menemukannya audit tautan internal ke halaman yang tidak ada, bukan
    membaca kodenya.

43. **`<button>` TIDAK mewarisi font maupun `line-height`.** Baris menu
    yang dipindah dari `<a>` ke `<button>` bergeser beberapa piksel karena
    `line-height` tombol kembali ke `normal`. `font: inherit` juga bukan
    jawabannya — ia ikut mereset `line-height` dari shorthand-nya. Yang
    benar: warisi properti satu per satu (`font-family`, `line-height`,
    `letter-spacing`, `text-rendering`), seperti di `button.k-nav` dan
    `.k-transfer--tombol`.

44. **`outline: none` tidak mematikan cincin fokus global.** `global.css`
    memberi tiap elemen fokus DUA tanda: outline 2px dan halo
    `box-shadow` 6px. Isian kit yang menandai fokusnya di kotak pembungkus
    (`:focus-within`) cuma mematikan outline — jadi halonya tergambar sebagai
    kotak hijau kedua DI DALAM kotaknya, di setiap isian dan pemilih kit,
    berbulan-bulan di produksi. Kalau menandai fokus di pembungkus, matikan
    keduanya (`outline: none; box-shadow: none`) dan pastikan pembungkusnya
    memang punya aturan `:focus-within` yang terlihat — garis mint di atas
    bidang abu (kotak cari, kontras ~1,2) tidak dihitung.

45. **Router sisi klien memakai animasi PUDAR SILANG bawaan untuk seluruh
    dokumen.** `transition:animate="none"` di `<main>` saja tidak cukup:
    semua yang di luarnya — termasuk judul di kepala halaman — tergambar
    tumpang-tindih ±120 ms tiap pindah menu ("Tugas" di atas "Info Studio"),
    dilaporkan pemilik sebagai "efek". Ditutup dengan
    `transition:animate="none"` di `<html>` KitLayout. Saudaranya: transisi
    `background-color` di aturan dasar `.k-nav` ikut berjalan saat baris
    AKTIF berpindah, jadi dua pil tampak aktif bersamaan; transisi kini cuma
    di `:hover`.

46. **Aturan layout berkelas ikut mengenai salinan komponen di dalam
    halaman.** `.kl .k-sisi { position: sticky; height: 100vh }` dimaksudkan
    untuk rel halaman, tapi galeri UI Component memuat contoh SisiNav di
    dalam `.kl` — contohnya ikut menempel 240x900. Aturan yang menyasar SATU
    elemen kerangka ditulis dengan id-nya (`#kl-rel`).

47. **Hover yang warnanya sama dengan latar induknya adalah hover yang tidak
    ada.** Menu sidebar sempat ber-hover `--brand-soft` di atas rel yang juga
    `--brand-soft`: aturannya ada, tidak ada yang pernah melihatnya. Audit
    hover mekanis (`/tmp/uji01/rg/interaksi.mjs` di sesi; polanya: hover tiap
    kontrol, bandingkan gaya diri + induk + SELURUH keturunan, tandai kelas
    hanya kalau TAK SATU PUN elemennya bereaksi, lewati yang aktif) menemukan
    29 jenis elemen bisu. Alat pertamanya sendiri buta pada `background-image`
    dan pada garis bawah judul di dalam kartu — jebakan #36 lagi. Polanya
    sekarang satu: `--k-hover-tint` dilapis lewat `background-image`, jadi
    bekerja di atas latar apa pun dan di kedua tema.

48. **Data contoh di produksi: ID berawalan `c0de000`.** Atas permintaan
    pemilik, Jan–Okt 2026 diisi data contoh untuk enam proyek ASLI (tanpa
    proyek baru): 16 tagihan, 11 pembayaran, 34 biaya, 16 gaji, 19 tugas, 15
    pesan masuk, 6 kontak, 6 anggota tim, 4 testimoni, 4 draf jurnal; nilai
    kontrak dan tahap lima proyek ikut diubah. Testimoninya SEMUA "menunggu"
    (jangan disetujui — yang disetujui tampil di situs sebagai ulasan
    palsu), dan jurnalnya SEMUA draf — tapi indeks `/jurnal` tetap
    menampilkan judul draf sebagai "rencana" begitu situs dibangun ulang,
    jadi hapus dulu sebelum menekan Terbitkan kalau judulnya tak boleh
    terlihat. Sumbernya `scripts/contoh/buat.py`; **`scripts/contoh/
    hapus.sql` membuang semuanya dan mengembalikan nilai asli proyek** —
    jalankan lewat konektor Supabase (`execute_sql`) begitu pemilik selesai
    melihatnya. Sengaja TIDAK diisi: pembaruan portal klien dan komentar
    dokumen — keduanya tampil di `/progres` proyek SUNGGUHAN, yang tautannya
    bisa dibuka klien asli. Email
    memakai `example.com` dan telepon dikosongkan supaya tombol WhatsApp/
    email tidak pernah sampai ke orang sungguhan; nama klien asli tidak
    dipakai untuk pesan karangan. Selama data ini ada, angka keuangan panel
    BUKAN angka studio.

49. **cmdk menandai SETIAP butir dengan `data-disabled="false"`.** Selektor
    `[data-disabled]` karena itu cocok untuk semua butir, dan seluruh isi
    Combobox serta palet perintah tergambar redup seperti mati. Radix justru
    menulis `data-disabled=""` hanya saat mati. Tulis nilainya eksplisit:
    `[data-disabled=""], [data-disabled="true"], [aria-disabled="true"]`.

50. **Radix ScrollArea membungkus isinya dengan `<div style="display:table">`**,
    jadi `text-overflow: ellipsis` di dalamnya tidak pernah menyala — tabel
    tumbuh selebar isinya. Ditutup di `kit-komponen.css` dengan
    `.k-gulir__viewport > div { display:block !important }`.

51. **Palet perintah TIDAK boleh dimuat malas.** Versi `lazy()` menelan huruf
    yang diketik sesudah Ctrl/Cmd+K tapi sebelum modulnya tiba: "gaji"
    sampai sebagai "ji", dan Enter membuka halaman yang salah. Tes alur
    menangkapnya; mata tidak. `PaletPanel` diimpor langsung di `KepalaKit`.

52. **`import.meta.glob` tidak pernah memuat berkas pemanggilnya sendiri.**
    Pemindai "Dipakai di" mem-glob `pages/admin/**`, jadi `/admin/kit` —
    halaman yang memanggil glob itu — diam-diam tidak ikut, dan Navigation
    Menubar terhitung tidak dipakai. Galeri sekarang dihitung langsung dari
    grafnya (`semuaPakai("kit/Galeri")`).

53. **Latar halaman kit kini ABU (`--k-latar`), dan kontrol yang duduk
    langsung di atasnya perlu bidang sendiri.** Kotak cari, tombol bulat,
    dan pemilih yang dulu putih-di-atas-putih tinggal sebagai garis di atas
    abu. Daftarnya di `kit.css` bagian "DI ATAS LATAR HALAMAN" — kalau
    menaruh kontrol baru di luar kartu, tambahkan ke sana. Teks di atas abu
    juga kena: remah dan tautan kaki turun ke rasio 2,94 dan 1,68 sebelum
    dipindah ke `--text-muted`; jalankan `kontras.mjs` sesudah menambah teks
    di luar kartu.

54. **`overlay.css` tidak lagi dimuat halaman kit.** Dialog, laci, menu, dan
    toast di kerangka kit memakai `components/kit/Overlay.tsx` + `Toast.tsx`
    dengan gaya di `kit-komponen.css`. Mengimpor dari `ui/overlay/*` di
    halaman kit menggambar tombol MENTAH bawaan peramban — itu persis cacat
    produksi yang ditemukan di dialog konfirmasi hapus (jebakan #5). Yang
    masih memakai `ui/overlay` hanya kerangka lama (`/admin/ui`, `/admin/masuk`).

55. **Angka ringkas terpenggal di kolom sempit: "Rp170 / jt".** Spasi biasa
    antara angka dan satuan boleh dipenggal, dan di tabel Laba per Proyek,
    Fee per Proyek, serta legenda Fee per Jenis separuh angkanya turun ke
    baris berikutnya — terbaca sebagai dua angka. `formatRupiahRingkas`
    kini memakai spasi tak-terputus (U+00A0). Kalau membuat pemformat
    satuan lain, lakukan hal yang sama.

56. **Kolom kanan yang `flex: none` + `nowrap` mencuri ruang dari angka
    utamanya.** Kartu ringkas Keuangan memotong keempat nominal ("Rp532…")
    karena keterangan kanannya dikunci selebar teksnya. Yang boleh mengalah
    di kartu angka adalah keterangannya, bukan angkanya: angka `flex: none`,
    keterangan `min-width: 0` dan boleh dua baris (`text-wrap: balance`).
    Diukur dengan membandingkan `scrollWidth` dengan `clientWidth` tiap
    nominal di 1440/1280/1024/390 — bukan dengan melihat.

57. **Kartu keterangan grafik vs. titik PUNCAK.** Kartunya duduk di ruang
    atas plot; ketika titik yang disorot menjulang sampai ke situ, pita
    penanda tergambar MENIMPA angkanya (Fee Proyek, September). `GrafikArea`
    kini memindah kartunya ke bawah penanda kalau ruang di atas tidak cukup
    (tinggi kartu 64 dengan keterangan, 44 tanpanya), dan kartunya
    ber-`z-index` di atas pita.

58. **Pemindai kode mati: knip.** `npx knip` dengan entry `src/pages/**`
    menemukan komponen tanpa pemakai, ekspor yang tak pernah diimpor, dan
    fungsi API usang — termasuk `tambahBiaya` yang sudah lama digantikan dan
    mekanisme "jumlah baris diingat" yang tetap menulis ke localStorage
    padahal tidak dibaca siapa pun. Kecualikan `kit/ikon/daftar.ts`: itu
    pustaka ikon yang ditampilkan galeri, bukan kode mati. Untuk CSS yatim
    tidak ada alat jadi — pindai nama kelas tiap stylesheet terhadap seluruh
    `src`, dengan memperhitungkan kelas yang dirakit (`k-tgl--${…}`).

59. **Elemen absolut tanpa leluhur ber-posisi lolos dari `overflow:
    hidden`.** Kerangka satu layar mengunci `.kl` setinggi layar dengan
    `overflow: hidden`, tapi judul `.sr-only` di Detail Tulisan dihitung
    terhadap DOKUMEN — halamannya tetap bisa digeser 636px di 1280x800.
    Ditutup dengan `position: relative` di `.kl__isi`. Yang membuktikan
    `scrollingElement.scrollHeight − innerHeight`, bukan melihat: tidak ada
    yang tergambar di bagian yang bisa digeser itu.

60. **Tinggi grafik yang dioper sebagai PROP jadi gaya inline.** `GrafikArea`
    (`--k-area-t`), `KolomGrafik` dan `LabelYGrafik` (`--k-kolom-h`) menulis
    tingginya di atribut `style`, jadi aturan stylesheet biasa tidak pernah
    menang — penimpanya wajib `!important`. Dashboard memakai
    `--dsb-plot-h` (140, satu layar 96) yang juga menggerakkan garis kisi dan
    posisi kartu keterangannya; jangan kembali ke angka piksel di TSX.

61. **Anak flex kolom ikut MENYUSUT kecuali `flex: none`.** Kepala rel
    `height: 68px` tergambar 27px di laci ponsel, karena `flex: none`-nya
    cuma dipasang di blok desktop, dan logonya terpotong. Tinggi tetap di
    dalam flex kolom selalu butuh `flex: none` di aturan yang sama.

62. **Daftar "DI ATAS LATAR HALAMAN" mengalahkan aturan KEADAAN.** `:is()`
    mengambil kekhususan argumen tertingginya, jadi `.kl-body :is(…)`
    bernilai (0,4,0) dan menimpa `.pjs__tagar[aria-checked="true"] .k-keping`
    (0,3,0): keping kategori yang terpilih di Detail Tulisan tergambar
    putih-di-atas-putih di produksi. Tiap butir daftar itu harus
    mengecualikan keadaan aktifnya sendiri (`:not([aria-checked="true"])`,
    `:not(.is-aktif)`).

63. **Lebar kolom frame dibuat untuk DOLAR, bukan rupiah.** "$1,500"
    muat di 94px; "−Rp15.000.000" tebal tidak. Di Semua Transaksi nominal
    meluber ke kolom Catatan dan "—"-nya menempel seperti coretan; di Gaji
    lencana "Tandai dibayar" terpotong tepi kartu. Keduanya sudah di
    produksi berbulan-bulan. Lebarnya digeser dari kolom tetangga (jumlahnya
    tetap). Mengauditnya: bandingkan kotak `Range` isi tiap sel dengan kotak
    selnya — tapi LEWATI sel yang memotong dengan sengaja (elipsis,
    line-clamp, anak ber-overflow hidden), karena Range tetap melaporkan
    teks yang tersembunyi (jebakan #36).

64. **Dua tes repository yang berbagi SATU database lokal saling menghapus
    skema.** Vitest menjalankan berkas tes paralel, dan `uangRepo.test.ts`
    membangun ulang skema di database `postgres`. Tes kedua yang memakai
    database yang sama gagal dengan `schema "auth" does not exist` — galat
    yang tidak ada hubungannya dengan kode yang diuji, dan lolos kalau
    tesnya dijalankan sendirian. `timKasRepo.test.ts` karena itu membuat
    database sendiri (`uji_timkas`). Tes repository baru: database baru.

65. **Butir grid ber-`overflow: hidden` punya ukuran minimum NOL.** Sampul
    Detail Tulisan (`aspect-ratio` + `overflow: hidden`) di grid satu-layar
    membuat barisnya mengempis, dan kolom isi tulisan naik tertumpuk DI
    BELAKANG gambar sampul — kotak isinya tidak bisa diklik sama sekali,
    berbulan-bulan di produksi. Untuk sekadar memotong sudut pakai
    `overflow: clip`: hasil gambarnya sama, tapi ia bukan kotak gulir.
    Yang menemukannya audit `elementFromPoint` di tengah tiap kontrol.

66. **Radix Select di dalam `<form>` memasang `<select>` tersembunyi
    berposisi absolut.** Tanpa leluhur ber-posisi ia dihitung terhadap
    `.kl__isi` dan memanjangkan area gulir (Proyek Baru: 645px). Dijepit
    `position: fixed !important` di `kit-komponen.css` — jangan dilepas.

67. **Di bawah 1288 akar halaman kit TIDAK boleh menyusut.** Kolomnya
    ditumpuk dan memang lebih tinggi dari layar; dijepit setinggi layar,
    kartu bertumpuk ber-`overflow: hidden` mengempis sampai 32px (Keuangan
    pada 1280/1024). `flex-shrink: 0` di `KitLayout` untuk rentang itu.

68. **Animasi yang menyebut keyframes yang TIDAK dimuat membuat panel Radix
    tidak pernah tertutup.** Radix Presence menunggu `animationend` sebelum
    melepas isi popover. Panel lonceng dan Pesan (`.kp`) memakai
    `ov-pop-in`/`ov-fade-out` milik `overlay.css` — yang tidak dimuat halaman
    kit (jebakan #54) — jadi animasinya tidak pernah berakhir: menekan
    pemicunya lagi membalik `aria-expanded` ke false, tapi panelnya tetap
    tergambar. Dilaporkan pemilik: "saya tekan notifikasi, mau tekan lagi
    dia ga nutup". Sekarang `k-timbul`/`k-pergi` dari `kit.css`. Alat
    ujinya `toggle.mjs` di sesi: klik tiap pemicu ber-`aria-expanded` /
    `aria-haspopup` dengan TETIKUS sungguhan, lalu klik lagi dan hitung isi
    yang masih terpasang — dialog modal (yang menutup pemicunya) diuji
    dengan Escape. Terukur 382 pemicu di 38 halaman, 0 tidak menutup. Kalau
    menambah animasi pada isi Radix, pastikan nama keyframes-nya hidup di
    stylesheet yang halaman itu muat.

69. **Wilayah toast Radix ikut jadi butir flex halaman satu-layar.**
    `ToastProvider` menaruh `<div role="region">` sebagai SAUDARA akar
    halaman di dalam pulau, dan aturan satu-layar KitLayout memberi setiap
    anak pulau `flex: 1` — jadi wilayah kosong itu menelan separuh sisa
    tinggi (terukur 48px kosong di bawah panel Akun). Halaman Akun menutupnya
    sendiri (`astro-island:has(> .akn) > [role="region"] { flex: none }`),
    begitu juga Aturan Fee Tim (`.atf`, 14–28px); halaman lain belum diperiksa — kalau kartu bawahnya tidak sampai ke kaki,
    ini tersangka pertama.

70. **Hiasan TIDAK BOLEH lewat di belakang tulisan.** Aturan pemilik
    ("saya tidak ingin ada text menimpa designnya"), dilaporkan dari dua
    potongan layar Bayaran Tim: segitiga tutup di baris rak yang dibuka
    lewat di belakang nama dan nominal, dan garis tutup amplop besar
    memotong "AMPLOP GAJI · NO. GJ-2610-BP". Hiasan boleh MENEMPEL pada
    tulisan (cap di ruang tanda tangan, segel pejal di ujung tutup), tapi
    tidak boleh ada garis, bidang, atau gambar yang melintas di belakang
    teks. Cara menutupnya di amplop: tutup jadi pita sendiri dan isi mulai
    SESUDAH ujungnya (`padding-top: tutup + 6`), karena di kolom kiri/kanan
    garis tutup selalu lebih tinggi dari ujungnya. Mengujinya MEKANIS, bukan
    dengan melihat: kotak `Range` tiap simpul teks dibandingkan dengan garis
    tutup (y garis di titik teks yang terdekat ke tengah) dan dengan kotak
    hiasan; isi segel dikecualikan karena lingkarannya pejal (jebakan #36).
    Alat sesinya `/tmp/uji01/byt/timpa.mjs` — 5 lebar × 3 keadaan, 0 temuan.

71. **`TombolBulat` sebagai pemicu menu: Escape pertama menutup PETUNJUKNYA,
    bukan menunya.** `TombolBulat` membungkus tombolnya dengan `Petunjuk`
    (tooltip Radix). Sesudah diklik, kursor masih di atasnya, jadi petunjuk
    ikut terbuka dan jadi lapisan teratas — Escape ditangkap lapisan itu,
    menunya tetap terbuka, dan seluruh halaman tidak bisa diklik
    (`pointer-events: none` milik menu). Ketahuan di Terima Pembayaran lewat
    tes alur, bukan dari melihat. Pemicu menu di dalam halaman memakai
    tombol polos berikon (`.npg__menu`, `.kpb__menu`). Pemicu panel di
    `KepalaKit` belum diperiksa untuk kelas ini.

72. **Transform 3D yang MENETAP memaksa satu lapisan compositor per
    elemen.** Papan bursa sempat memberi tiap daun atas keping
    `transform: rotateX(-90deg)` sebagai rupa diam, ditambah
    `backface-visibility: hidden` di semua daun — ±1.300 lapisan
    sepanjang waktu, dan putaran yang seharusnya ringan tersendat di
    120–170 ms per bingkai (bingkai pertama 2,1 detik). Rupa diam yang
    benar TANPA transform (daun yang tak tampak cukup `opacity: 0`), dan
    transform 3D hanya hidup selama animasinya; animasi Web Animations
    dijalankan tanpa `fill` supaya tidak menumpuk ratusan sesudah selesai.
    Hasilnya median 16,7 ms. Mengukurnya: hitung jarak antar
    `requestAnimationFrame` selama gerak dan `document.getAnimations()`
    sesudahnya — tangkapan layar yang tiba-tiba lambat adalah gejala
    pertamanya.

73. **Deploy merah dalam 2 detik tanpa satu langkah pun = TAGIHAN GitHub,
    bukan kode.** Run #161 (8 Okt 2026): job Worker API `failure` dengan
    daftar langkah KOSONG dan tanpa runner; situs statis `skipped` karena
    `needs: api` — jadi situs lama tetap tayang utuh. Log tidak bisa
    diunduh dari sesi ini (diarahkan ke host blob Azure), tapi alasannya ada
    di anotasi check-run: `gh api repos/<o>/<r>/check-runs/<job-id>/annotations`
    → "recent account payments have failed or your spending limit needs to
    be increased". Repo ini PRIVAT, jadi menit Actions dihitung ke akun
    `sheetcodeid-ux`. Jangan menebak "flake" dan jangan mengulang run —
    hasilnya sama sampai pemilik membereskan Settings → Billing and plans.
    Halaman tagihan akun tidak terjangkau dari sesi ini (403, sesi terikat
    ke repo).

74. **Gerak yang dipicu "nilai berubah" ikut menyala saat DATA datang, bukan
    cuma saat pengguna berbuat.** Nomor lembar di kop rel menggulung saat
    berganti — dan di Info Studio serta UI Component ia menggulung SAAT
    HALAMAN DIMUAT, karena baris khusus master baru ada sesudah peran dibaca
    (nomornya berganti "—" → G-01). Pemicunya kini PERPINDAHAN PATH, bukan
    perubahan nilainya. Saudaranya: kelas animasi yang ditempel sesudah
    bingkai pertama (supaya "tidak saat muat") tetap MEMUTAR animasinya —
    menambah `animation-name` ke elemen yang sudah ada memulai animasi.
    Pakai transisi yang hanya dideklarasikan di keadaan tujuan, atau kunci
    pemicunya ke perbuatan. Ketahuan dari uji alur yang memeriksa kelas
    `is-gulung` di 32 muat penuh, bukan dari mata.

    Catatan alat uji di putaran yang sama: `el.querySelector("div:last-child
    b")` ikut mencocokkan LELUHUR di luar `el` (selektor dicocokkan terhadap
    seluruh dokumen, cuma hasilnya yang dibatasi) — sel Tanggal terbaca
    sebagai sel Lembar. Pakai `:scope > div:nth-child(n)`.

75. **Aturan JEDA animasi kalah dari shorthand `animation` yang lebih
    khusus — dan hasilnya serempak, bukan rusak.** Pena di rel menggambar
    garis ikon satu per satu lewat `:nth-child(n) { animation-delay }`
    (0,3,2), tapi aturan animasinya sendiri `… svg:not(.k-sisi__lipat)
    path:not(.isi) { animation: … }` bernilai (0,4,2), dan shorthand itu
    mereset `animation-delay` ke 0. Kelima garis tergambar SERENTAK; tidak
    ada galat, dan di video "pena berjalan" tetap terlihat benar. Yang
    menangkapnya jejak `strokeDashoffset` tiap garis per bingkai
    (`pena-jejak.mjs` di sesi): angkanya kembar. Aturan jeda wajib memuat
    pengecualian yang sama (`:not(.k-sisi__lipat)`, `:not(.isi)`) supaya
    kekhususannya di ATAS aturan animasinya. Berlaku untuk setiap
    `transition-delay`/`animation-delay` yang ditulis terpisah dari
    shorthand-nya.

76. **Mengukur kotak yang sedang dianimasikan masuk memberi letak yang
    salah — dan tidak pernah diukur ulang.** Penanda potongan rel diukur di
    `useLayoutEffect` sesudah render; saat submenu dibuka, barisnya sedang
    mulai `translateY(-6px)` (animasi urai), jadi `getBoundingClientRect()`
    membaca 6px terlalu tinggi dan penanda BERHENTI di sana — tidak ada
    render berikutnya yang membetulkannya. Yang dianimasikan kini ISI baris
    (`.k-nav > *`, lewat `translate` — bukan `transform`, yang dipakai garis
    potong), sementara kotak barisnya diam. Aturannya: kalau sesuatu
    mengukur sebuah kotak, jangan animasikan transform pada kotak itu atau
    leluhurnya; animasikan anaknya.

77. **`[pathLength]` di selektor membuat Chrome LUPA menghitung ulang gaya.**
    Nama atribut SVG ber-huruf-besar itu cocok saat dicocokkan
    (`el.matches("[pathLength]")` true), tapi aturan
    `html[data-kl-pindah] … path[pathLength]` tidak pernah menyala saat
    atribut di `<html>` DIPASANG, dan animasi yang sudah menyala TERTINGGAL
    menempel sesudah atributnya DILEPAS — `getComputedStyle` masih menulis
    `k-tarik` dan `stroke-dasharray: 1px` padahal tidak satu pun aturan cocok
    (CDP `CSS.getMatchedStylesForNode` kosong). Aturan yang sama TANPA
    `[pathLength]` bekerja sempurna. Ikon jadi tampak putus-putus permanen
    sesudah pindah halaman. Jangan pakai `[pathLength]` (atau atribut SVG
    camelCase lain) di selektor yang bergantung pada keadaan leluhur; pakai
    kelas atau struktur (`> svg`, `:not(.isi)`). Yang menemukannya: uji alur
    yang membaca `strokeDasharray` 1,5 detik sesudah pindah — dan menyerah
    menebak sampai Chrome sendiri ditanya lewat CDP.

78. **React 19 menulis ulang `innerHTML` SETIAP render kalau objek
    `dangerouslySetInnerHTML`-nya baru.** React 18 membandingkan
    `__html`-nya; React 19 membandingkan IDENTITAS objek, jadi
    `dangerouslySetInnerHTML={{ __html: … }}` membuang dan membuat ulang
    seluruh `<path>` ikon tiap kali komponen pemakainya digambar ulang.
    Gejalanya: animasi Web Animations yang dipasang di penangan klik pada
    garis ikon (lengan lampu tema) tidak pernah terlihat — elemennya dibuang
    sesaat kemudian oleh render yang dipicu klik yang sama — dan animasi CSS
    pada garis ikon mulai ulang di tengah jalan bila ada render di tengahnya
    (pena rel sempat tergambar dua kali di video). `kit/Ikon.tsx` kini
    menyimpan SATU objek `{ __html }` per ikon di WeakMap. Kalau menulis
    `dangerouslySetInnerHTML` lain yang isinya dianimasikan, lakukan hal
    yang sama.

79. **cmdk tidak mengurutkan KELOMPOK menurut skor.** Butir di dalam satu
    kelompok memang diurut, tapi kelompoknya tetap dalam urutan pasangnya —
    jadi "lampu" di palet memilih "Halaman Publik" (kelompok Pekerjaan,
    lebih dulu di rel) dan Enter membuka halaman yang salah, sementara
    "Nyalakan lampu meja" (skornya jauh lebih tinggi) tinggal di bawah.
    Palet kit kini `shouldFilter={false}`: penyaringan dan urutan milik
    `saringKelompok()` di `kit/Palet.tsx`, dengan skor `defaultFilter` cmdk
    yang sama, kelompok diurut menurut butir terbaiknya, dan pilihan
    dikendalikan (butir TERBAIK dipilih tiap kali kata cari berganti).
    Saudaranya: `value` butir boleh id (uuid proyek) — yang dicocokkan
    KATA KUNCINYA, kalau tidak huruf heksadesimal ikut tercari. Ketahuan
    dari tes alur, bukan dari mata: tangkapan layar "lampu" tampak wajar.

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
| `psql "$SUPABASE_DIRECT_URL" -f supabase/tests/rls_test.sql` | 166 assertion RLS |
| `./scripts/rls-lokal.sh` | 166 assertion RLS di Postgres lokal, tanpa menyentuh produksi. **Jalankan sekali** dan `test/uangRepo.test.ts` serta `test/timKasRepo.test.ts` ikut hidup — ia melewati dirinya sendiri kalau Postgres lokal belum ada |
| `node scripts/banding/kontras.mjs <jalur…>` | Kontras teks & ikon di kedua tema (jebakan #37) |
| `node scripts/banding/potong.mjs <jalur…>` | Teks TERPOTONG/MELUBER per simpul teks di 5 ukuran; `KARTU=` pemilih kartu, `RUSAK=` CSS untuk membuktikannya merah (jebakan #36) |
| `./scripts/build-bootstrap.sh` | Regenerate `supabase/bootstrap.sql` |
| `./scripts/setup-fase-04.sh` | Provisioning Hyperdrive + rahasia Worker API, lalu deploy |

`supabase/bootstrap.sql` **hasil generate** — ubah migrasinya, lalu jalankan
skrip; jangan sunting hasilnya.

## Sumber desain: Figma "Coinest"

Panel admin dibangun mengikuti file Figma **Coinest — Finance Management
Dashboard**, file key `62HM59sb04oWlZoT3EcCyN`. Dua halaman: `1:3028`
(💻 Interface, 42 frame) dan `0:1` (🎨 Style & Component).

Permintaan pemilik, dikatakan berkali-kali dan makin tegas: **100% mirip
framenya**, dibangun dari lembar kosong, urutannya **ikon → pustaka komponen →
wireframe 14 halaman → halaman satu per satu**. Jangan melompat, dan jangan
mewarnai ulang tata letak lama lalu menyebutnya rombak.

### Dua batas yang sudah diuji, bukan dugaan

1. **Kuota MCP Figma: 20 panggilan per BULAN.** Akun
   `muhammadlutfirijalulfikri00@gmail.com`, seat **View**, tier **starter** —
   dan tabel resmi Figma menaruh View/Collab di Starter pada 20/bulan. Sudah
   habis. `whoami` bebas kuota, sisanya tidak.

   Yang menaikkannya: plan **Professional** DAN seat **Dev atau Full**
   (200/hari). Dua-duanya harus. View di Professional justru **6/bulan** —
   lebih buruk daripada Starter, jadi jangan menyuruh upgrade plan saja.

2. **Unduh berkas aset TIDAK BISA, berapa pun kuotanya.** URL aset yang
   dikembalikan Figma ada di `www.figma.com`, dan gateway jaringan sesi ini
   menolak host itu. Terukur: `http:000`, `connect_rejected`, kebijakan
   organisasi. Bukan soal setelan Figma, permission, atau tautan berbagi.

   Akibatnya **ikon harus dikirim pemilik sebagai lampiran** — lihat
   `apps/web/src/assets/figma/ikon/DAFTAR.md` untuk setelan ekspornya.
   Menggambar ulang ikon dari tangkapan layar TIDAK boleh; itu menjiplak dan
   tidak akan pernah persis.

### Yang masih boleh dipakai tanpa kuota

Tangkapan layar frame lewat `get_screenshot` dengan `enableBase64Response`
datang lewat jalur MCP, bukan HTTP — jadi ia tidak kena blokir gateway. Tapi
ia tetap MEMAKAI kuota. Gambarnya DISIMPAN sebagai berkas PNG di folder
`tool-results` sesi (namanya disebut di hasil panggilan), jadi bisa diukur
dengan alat banding seperti PNG ekspor pemilik — tidak perlu meminta ulang.
Hasil `get_design_context` juga tersimpan utuh di transkrip sesi; ambil dari
sana sebelum memakai kuota lagi. Yang benar-benar gratis: PNG yang diekspor pemilik
sendiri dan dilampirkan ke percakapan.

### Bahan yang sudah ditarik dan tidak perlu diulang

Tersimpan di repo ini (token) dan di riwayat percakapan (angka frame):

- Seluruh token warna, font, ukuran, radius → sudah jadi `styles/tokens.css`
- Daftar **42 frame** beserta node ID dan ukurannya
- Spesifikasi Sidebar (`14:2803`), Header (`18:3780`), dan enam bagian
  Dashboard v1: kiri `3:1127`, statistik `3:1188`, kolom grafik `3:1210`,
  kanan `3:1245`, kepala seksi `11:1745`

### Pemetaan 14 frame ke halaman admin

| Frame Figma | Halaman |
| --- | --- |
| 01. Dashboard (v1) `3:1069` | Dulu `/admin`; sejak Okt 2026 Dashboard jadi RUANG KENDALI STUDIO (lihat Riwayat keputusan). `dash-kit.css` dibuang |
| 04. Dashboard (v2) `18:2771` | Dulu Keuangan — Ringkasan; sejak Okt 2026 halaman itu MEJA GAMBAR: lembar Kurva S + Rekapitulasi (lihat Riwayat keputusan). `keuangan-kit.css`, `neraca-kit.css`, dan `bursa-kit.css` dibuang |
| 07. Transfer `63:1868` | Dulu Terima Pembayaran; sejak Okt 2026 halaman itu kotak kartu pembayaran klien (lihat Riwayat keputusan). `bayar-kit.css` dan `terima-kit.css` sudah dibuang |
| 10. Payment `92:2248` | Dulu Catat Pengeluaran; sejak Okt 2026 halaman itu buku nota pengeluaran + paku nota (lihat Riwayat keputusan) |
| 13. Transactions `108:3478` | Dulu Semua Transaksi; sejak Okt 2026 halaman itu rekening koran studio di kertas continuous form (lihat Riwayat keputusan). Kerangka daftar frame 13 tetap hidup di `daftarKit.tsx` untuk Tugas, Direktori, Testimoni, Tim |
| 16. Invoices `121:3433` | Dulu Tagihan & Termin; sejak Okt 2026 halaman itu papan jadwal termin + papan jepit surat tagihan (lihat Riwayat keputusan) |
| 19. Cards `132:6490` | Dulu Semua Proyek; sejak Okt 2026 halaman itu rak ordner proyek (lihat Riwayat keputusan). `transaksi-kit.css` dibuang; `proyek-kit.css` tinggal `.pro__pilih` milik `PilihTeks` |
| 22. Saving Plans `132:7043` | Satu Proyek |
| 25. Investments `132:7596` | Dulu Fee Proyek dan Gaji. Sejak Okt 2026 keduanya punya bentuk sendiri — Gaji buku gaji, Fee Proyek buku kuitansi fee (lihat Riwayat keputusan); dari frame ini tinggal bahan bersama di `frame25.tsx` |
| 28. Inbox `173:5228` | Pesan Masuk |
| 31. Promos `196:5554` | Paket Layanan (6 tier) |
| 34. Promo Details `196:6036` | Detail satu tier |
| 37. Insights `196:6267` | Jurnal |
| 40. Insight Details `196:6508` | Satu tulisan |

Tiap frame punya varian Tablet dan Mobile — responsifnya tidak perlu dikarang.

### Yang SUDAH ketahuan meleset dan sudah diperbaiki

Dicatat supaya tidak diulang kalau suatu saat dibangun ulang:

- *(Kepala kelompok sudah DIKEMBALIKAN atas permintaan pemilik — lihat
  "Rel berkategori" di Riwayat keputusan. Butir ini tetap benar tentang
  framenya.)* Sidebar Coinest **tidak punya** kotak cari, kepala kelompok, maupun tombol
  sempitkan. Ketiganya sempat ada dan itu yang paling membuat panel terbaca
  berbeda. Command palette tetap hidup lewat Ctrl/Cmd+K, dipasang di topbar
  dengan `tanpaTombol`.
- *(Tanggal hari ini sempat ditambahkan di bawah judul, lalu DIBUANG lagi
  atas permintaan pemilik — lihat "Kerangka kit = latar MINT + panel isi
  melengkung" di Riwayat keputusan. Kepala kini satu baris, seperti framenya.)*
  Header Coinest isinya **satu baris judul saja** di kiri. Baris
  tanggal/jam/jumlah proyek di bawahnya tidak ada di framenya.
- Footer ada di **setiap** frame Coinest.
- Warna irisan donat itu **tangga hijau→abu berurut besaran**
  (`--ramp-1`..`--ramp-5`), bukan lima rona kategorikal.
- Kartu di Coinest ber-radius **16px**, bukan 12px.
- Membaca kode acuan per bagian TIDAK cukup — frame utuhnya harus dilihat
  sebagai gambar dulu. Sekali dilewatkan, dan hasilnya gridnya benar
  sementara seluruh kerangkanya salah.

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
| **Halaman Akun = halaman PROFIL bertema LEMBAR GAMBAR KERJA, bukan dashboard** | Pemilik menilai versi lama "0", menolak versi tiga kolom yang meniru Dashboard ("jangan juga layaknya … tapi akun versi upgrade"), lalu meminta UI-nya dinaikkan lagi. Bentuknya: sampul kertas kalkir dengan denah garis hiasan, sumbu grid berbulatan A–D / 1–2 bergaris titik-strip, garis ukur, panah utara, dan **kop lembar berisi data akun sungguhan** (peran, sesi aktif, terakhir masuk); avatar 104 bertitik hidup; tombol pintas Ubah nama / Ganti kata sandi; tab bergaris bawah (pola tab ARIA lengkap, panah/Home/End) disimpan di alamat (`#keamanan`). Tab **Profil**: kartu staf berbentuk badge tegak berlubang tali yang miring mengikuti TETIKUS saja (jebakan #9; diam bila gerak dikurangi) dan ikut nama yang sedang diketik, baris setelan, hak akses dari `lib/navAdmin`. **Keamanan**: sandi lama wajib, mata per isian, meter kekuatan berperisai, syarat menyala, sandi acak. **Perangkat**: kartu bergambar garis laptop/ponsel/tablet dengan lambang sistemnya. **Tampilan**: pratinjau panel mini, "Ikuti sistem" dibelah miring. Nama tampilan = `profiles.full_name` (tanpa migrasi), dipakai kartu akun di rel lewat `PERISTIWA_PROFIL`. Terukur: keempat tab 0 gulir — dokumen, area isi, DAN panel — pada 1440x790 dan 1366x768; kontras bersih kedua tema; 31 cek alur di API tiruan |
| **Info Studio = lembar gambar kerja kedua; kerangka bersama `lembarKit`** | Halaman kedua yang mengikuti "Selera pemilik". Sampul, panah utara, kop lembar, dan tab bergaris dipindah ke `components/admin/lembarKit.tsx` + `styles/lembar-kit.css` dan dipakai Akun DAN Info Studio (jebakan #32); Akun terbukti tidak berubah (ponsel identik piksel demi piksel, desktop hanya beda teks jam dari API tiruan). Gambar sampulnya milik tiap halaman: Akun DENAH, Info Studio TAMPAK dengan penanda peil ±0.00/+3.50/+6.80; kop lembarnya data studio (kota, tahun berdiri, zona). Logo besar di kepala bisa diklik dan diseret untuk mengganti. Empat tab, masing-masing isian + pratinjau TEMPAT DATANYA MUNCUL: Identitas → kepala situs (wordmark tanpa ekor "Architecture", logo segi enam teal bila kosong — sama dengan Header.astro), Kontak → kaki situs (baris kosong dihilangkan — sama dengan Footer.astro) + tombol uji mailto/wa.me/Instagram, Lokasi → jam studio menurut zona (jam panel & tanggal PDF), Kop dokumen → kop PDF digambar dalam `cqw` = pt × 100 / 595,28 dari `lib/pdf.ts`, di atas "meja" yang lurus saat disentuh. Satu Simpan di kepala untuk keempat tab; isian wajib yang kosong ditandai angka amber di tabnya. Logika lama (hanya kolom berubah yang dikirim, logo baru berlaku saat Simpan) dibawa apa adanya — 22 cek alur |
| **Akun & Info Studio "1000x": benda yang bisa disentuh di tiap lembar** | Permintaan pemilik sesudah keduanya jadi ("tingkatkan 1000x lipat" — tampilannya, bukan fitur). Kerangka bersama `lembarKit` mendapat KURSOR CAD di sampul (garis silang + koordinat X/Y dalam mm, snap ke kisi 48px; tetikus saja, kotak dibaca sekali saat masuk — jebakan #9/#21), kop lembar berjudul + panah utara, bingkai tepi kertas, dan garis tab yang MELUNCUR (sebelum diukur, tiap tab terpilih menggambar garisnya sendiri). Akun: kartu staf DIGANTUNG tali dan berayun dari titik gantungnya ke arah kursor lalu memantul balik (variabelnya di `.akn__gantung`; default di `.akn__staf` akan memutus pewarisannya), gembok garis yang busurnya turun mengunci saat kelima aturan sandi terpenuhi, layar laptop "perangkat ini" menggambar panel ini sendiri, dan ganti tema sebagai LINGKARAN yang melebar dari titik klik (View Transitions; pudar silang bawaannya dimatikan hanya selama kelas `lbr-temaganti` ada, jadi router tidak kena). Info Studio: pratinjau kepala situs Desktop/Ponsel (ponsel = Header.astro di bawah titik-patahnya), jam busur derajat yang jarumnya dari jam ZONA studio, dan pemilih Rincian Biaya / Daftar Tagihan / Slip Gaji yang mengganti badan kertas — ukurannya dari `unduhPdf()` dalam cqw, barisnya ditandai CONTOH. Terukur: semua tab, termasuk Ponsel dan ketiga dokumen, 0 gulir pada 1440x790 & 1366x768; kontras bersih kedua tema; 0 geser mendatar di 390 |
| **Foto pribadi akun (`profiles.avatar_key`, R2 `akun/`), dipotong di PERAMBAN** (migrasi `20261006000030`) | Permintaan pemilik: "akun bisa upload foto juga, jadi akun foto pribadi, info studio foto studio". Info Studio sudah punya logo; yang ditambah foto akun. Berkas dipotong persegi dan dikecilkan ke 512px WebP (JPEG kalau peramban tidak bisa menyandikan WebP) di dialog `potongFoto.tsx` — geser, perbesar (penggeser, roda, papan ketik), dengan cuplikan di TIGA tempat fotonya muncul: kepala Akun, kartu staf, kartu akun di rel. Alasannya sama dengan thumbnail foto proyek: Worker tidak pernah memegang berkasnya. `PATCH /account/profile` kini menulis HANYA kolom yang dikirim (`nama` dan/atau `avatarKey`) — dulu badan tanpa `nama` menghapus nama. Kunci diperiksa dua kali (aplikasi + CHECK `^akun/…`). Berkas lama di R2 tidak dihapus saat diganti, sama seperti logo. `/me`, login, dan `/account` membawa `avatarUrl`; profil tersimpan ikut (`profilUntukDisimpan`, satu bentuk untuk simpanSesi dan sinkronkanProfil). **Migrasinya wajib diterapkan ke produksi SEBELUM merge** — `/me` membaca kolomnya, jadi API baru tanpa kolom = panel tidak bisa dibuka sama sekali. Sekalian di putaran yang sama: kaki kartu staf jadi kode batang + nomor staf (diturunkan dari email dan tahun bergabung, menggantikan pita mint yang ditolak pemilik), kartu staf bisa DIBALIK (belakangnya kop studio dari Info Studio), hover tab = garis ukur putus-putus, kop lembar dilonggarkan, Info Studio dapat judul tab peramban dan pratinjau hasil pencarian (judul/deskripsi beranda dari `lib/beranda.ts`, satu sumber dengan `index.astro`) |
| **Aturan Fee Tim = PAPAN ALIRAN FEE (diagram Sankey), bukan lembar dan bukan buku aturan** | Dua versi sebelumnya ditolak: salinan kerangka lembar Akun ("jangan disamakan semua") dan buku aturan + kalkulator ("masih biasa … upgrade ke pro max, saya beri kebebasan"). Halaman ini menjawab "fee design satu proyek mengalir ke siapa, berapa, kapan", jadi bentuknya diagram ALIRAN di bidang `--kas-bidang` (bidang uang kit, tidak ikut berbalik tema): batang fee design 0–100% (irisan tim per peran di atas, studio di bawah, garis putus JATAH dengan arsir amber untuk bagian yang melewatinya) → pita ke KARTU PERAN (persen diketik di kartunya; yang kosong bergaris putus amber dan tanpa pita) → pita ke dua node DIBAYAR (saat DP / saat Finish) yang dibelah PENANDA YANG DISERET (`role="slider"` sendiri: tetikus/jari lewat pointer capture, kotak dibaca sekali saat ditekan, panah/PageUp/PageDown/Home/End; isian angka tahap awal tetap ada di label DP). Satu fungsi geometri (`tataPeran` + irisan) dibaca kartu HTML dan pita SVG sekaligus, jadi tidak ada yang diukur dari DOM; pita digambar di SVG `preserveAspectRatio="none"` selebar selnya. Kartu peran tingginya AFIN (minimal 44 + bagian menurut persen) supaya isiannya muat — yang sebanding persis irisan di batang dan node. Warna peran DI BIDANG HIJAU tangga sendiri (`--atf-<peran>`: kas-ink, mint, dua campuran redup), di kartu putih tangga ramp kit seperti Satu Proyek. Kiri bidang: fee contoh (keping paket mengisi `feeMin`×1e6 — paket disimpan dalam JUTA), legenda bagian tim / studio / jatah. Bawah: Jatah (Busur kit, ukuran BAWAAN 112 — teks tengahnya dikalibrasi untuk itu dan meluber di 92), pratinjau Tim & Bayaran (`SelTahap` asli, tabel `inert`), slip gaji berkertas sobek (`keteranganFee` asli). Menyorot satu peran (tetikus saja) menyalakan kartu, kedua pita, irisannya, baris pratinjau, dan mengganti slip. Ponsel (≤40rem): kolom Dibayar turun ke bawah diagram tanpa pita kedua — tanpa gulir mendatar. Terukur: 0 gulir dokumen/isi/ketiga kartu pada 1440x790 & 1366x768, 0 geser mendatar di 390, kontras bersih kedua tema, 52 cek alur, 22 muat tanpa galat hidrasi. **Putaran "1000x" sesudah ACC (tampilan, bukan fitur):** pita BERGRADASI (`linearGradient` per peran di defs batang, pekat di ujung, menerawang di tengah); UANG MENGALIR — titik terang berjalan di garis tengah pita yang disorot (`.atf__alir`, `vector-effect: non-scaling-stroke` supaya tidak ikut direntangkan; elemennya hanya dipasang selama disorot, jadi tidak ada animasi abadi — jebakan #22); tiap pita, irisan batang, dan bagian studio menjawab "berapa" lewat `KartuGrafik` kit (state kartunya milik komponen kecil `KartuPita` lewat ref, jadi gerak kursor tidak menggambar ulang seluruh halaman); MISTAR 0–100 di sisi batang; angka utama "Tim menerima" bidang mint (menyentuhnya menyalakan seluruh aliran, sorot `"semua"`); keping paket tiga kolom bernama saja (harga di keterangan melayang — angkanya langsung tampil di isian fee) supaya angka utama muat; pijar mint statis di latar bidang; slip bertepi sobek atas-bawah dengan kop nama studio dari Info Studio (dibaca saja, kunci cache `settings` milik Info Studio — jebakan #8); kepala kartu Satu Proyek bergaya bilah judul layar. 56 cek alur |
| **Aturan Fee Tim putaran 21 butir: kop "diubah oleh", keping perubahan + dampaknya, garis hantu, gerak 160 ms** (migrasi `20261006000031`) | Pemilik bertanya apa yang masih bisa ditingkatkan, lalu "kerjakan semua". (1) **Kop data sungguhan**: "Terakhir diubah {waktu} oleh {nama} · Berlaku untuk penugasan baru dan tahap yang belum dibayar" — `studio_fee_settings.updated_by` (nullable, `on delete set null`, tanpa GRANT baru karena tabelnya cuma disentuh Worker) diisi PATCH dari `userID`; namanya `profiles.full_name`, jatuh ke bagian lokal email. **Migrasinya wajib diterapkan ke produksi SEBELUM merge** — `GET /admin/fee-rules/ringkasan` memilih kolomnya. (2) **Keping perubahan sebelum menyimpan** menggantikan kop: nilai lama dicoret → nilai baru → SIAPA YANG KENA, dihitung server dari `project_team` (penugasan berpersen kosong = ikut aturan; berpersen = dibekukan; `belumLunas` = penugasan dengan < 2 tahap tertaut di `project_costs`). Kop dan keping sama-sama 20px supaya kepala tidak meloncat saat isian pertama diubah; toast sesudah simpan menyebut dampaknya lagi. (3) Lencana angka di kartu peran = penugasan berjalan yang ikut aturan peran itu. (4) **Garis hantu** amber putus dari batang ke peran tanpa persen dan dari peran ke titik belah — peran yang belum ditentukan tetap terbaca sebagai bagian aliran. (5) Bagian studio di batang tidak mati: label tegak + garis buku + kartu keterangan. (6) Jatah tidak lagi ditulis tiga kali: legenda dibuang, cukup garis jatah di batang, Busur, dan satu kalimat; kalau terlewati ada tombol "Jadikan jatah N%" yang HANYA mengisi isian — memutuskan 10% vs 15% tetap milik pemilik, menyimpan tetap tombol Simpan. (7) Fee contoh bergaris putus + "tidak disimpan", keping paket membawa harganya. (8) **Gerak 160 ms** (`useHalus`): yang ditween hanya angka mentah geometri, teks tidak; data pertama MELOMPAT tanpa tween (tanpa animasi masuk); diam kalau gerak dikurangi. **Tes yang membaca geometri harus menunggu ±300 ms sesudah mengetik.** (9) Pegangan seret lebih besar + "seret untuk membagi". (10) Ponsel: kolom Dibayar membawa BATANG TIM dan pitanya sendiri; kop boleh terlipat. (11) Layar sentuh: ketuk pita = kartu keterangan, ketuk di luar = tutup (`pointerType` diperiksa, jebakan #9). (12) Kerangka memuat berbentuk papan dan SETINGGI papan aslinya (terukur sama pada 1440 & 1366), galat berbentuk papan dengan "Coba lagi". (13) Ringkasan pembaca layar `#atf-ringkas` lewat `aria-describedby`. (14) Tautan "Buka proyek" dan "Bayaran Tim" di kepala kartu. Wilayah toast menelan 14–28px di bawah kartu — jebakan #69, ditutup sama seperti Akun. **Safari TIDAK diuji** (sesi hanya punya Chromium): ditinjau saja — `color-mix` butuh Safari 16.2+, `mask-image` diberi awalan `-webkit-`, transisi `d` CSS sengaja dihindari lewat tween JS. Layar sentuh hanya diemulasi Playwright. Terukur: 0 gulir dokumen/isi/kartu pada 1440x790 & 1366x768 kedua tema, 0 geser di 390, kontras bersih (keping perubahan ≥4,41), 69 cek alur, 7 cek repository baru. Catatan alat uji: kueri `path` di kolom pita kini ikut menangkap garis hantu dan garis alir — saring `path.atf__pita`; dan `innerText` tidak memuat isi `::before` tapi IKUT `text-transform` |
| **Bayaran Tim = MEJA GAJI: rak amplop, buku upah, slip kertas/WhatsApp, riwayat 12 bulan** | Permintaan pemilik "selanjutnya keuangan bayaran tim". Bentuknya diturunkan dari benda dunia nyatanya (bukan salinan Aturan Fee maupun lembar Akun): (1) RAK AMPLOP di kiri — satu amplop per orang dengan terutang angka penuh, keadaan (jatuh tempo / belum tempo / lunas / tanpa proyek), dan METERAN dibayar · jatuh tempo · belum tempo; di atasnya ubin mint jumlah seluruh tim dengan meteran yang sama. Amplop yang dibuka bermint dengan lidah 3px. (2) KEPALA ORANG — avatar, peran · jenis · nomor WA (atau tautan amber "WhatsApp belum diisi"), Hak/Dibayar/Terutang, dan RIWAYAT DUA BELAS BULAN: batang gaji + fee per bulan yang sekaligus PEMILIH BULAN slip (menggantikan dropdown), titik amber = gaji bulan itu belum dibayar. Datanya `GET /admin/payroll/slip/history` (`payroll.riwayatSlip`) dengan saringan SAMA dengan `slip()` — tes menjaga batang = total slip. (3) BUKU UPAH — tiap penugasan satu LINTASAN dua ruas (awal/akhir) selebar nominalnya, lantai 148px; ruas dibayar (centang + tanggal), jatuh tempo (amber + Bayar → `DialogBayar` yang sama dengan Satu Proyek), menunggu (garis putus, bisa dibayar lebih awal), persen kosong (tautan ke Aturan Fee). Label ruas "Awal"/"Akhir", bukan "Tahap awal" — di 1366 yang panjang terpotong. (4) SLIP — Segmen Kertas | WhatsApp: kertas bertepi sobek berkop nama studio dengan CAP keadaan gaji (`paid_on`), atau gelembung berisi kalimat PERSIS yang dikirim tombol "Kirim WhatsApp". `SYARAT` kini diekspor `timProyekKit` (satu sumber). Riwayat flex `1 1 240px` + `max-width 400`, bukan dasar 380: flex-wrap menghitung lebar dasar, dan di 1366 riwayatnya turun ke baris kedua walau muat. Di ponsel rak lebih dulu (ketuk amplop menggulir ke kepala orang). Tanpa migrasi. Terukur: 0 gulir dokumen/isi pada 1440x790 & 1366x768, 0 geser di 390, kontras bersih kedua tema, 24 cek alur, 8 muat tanpa galat hidrasi, kerangka memuat setinggi aslinya, 5 cek repository baru. **Putaran "pro max" (permintaan pemilik "masih biasa aja"):** kepala orang jadi AMPLOP GAJI pejal (`--kas-bidang`, token yang tidak berbalik tema) — tutup segitiga selebar kartu (SVG `preserveAspectRatio="none"` + `vector-effect`), SEGEL avatar bergaris putus mint tepat di ujung tutup (kolom tengah grid `1fr 64px 1fr`), "Isi amplop {bulan}" = total slip bulan terpilih dengan cap gaji dibayar/belum, dan di dasarnya hak/dibayar/terutang + meteran + riwayat 12 bulan bermint. SLIP KELUAR DARI BALIK AMPLOP: di ≥1288 kartu slip naik `-(16px + --byt-selip)` di bawah amplop (z-index 1 vs 0) dan kertasnya diberi padding atas sebesar selipnya; tarik 5px saat disentuh tetikus (satu-satunya gerak, `hover:hover` + `pointer:fine` + tanpa reduced-motion). Pemilih Kertas/WhatsApp pindah ke kaki slip bersama tombolnya. Amplop yang dibuka di rak = versi mini amplop gelap (meteran ditimpa lewat kelas `m-bayar/m-tempo/m-belum`, bukan warna inline). Rak dapat ubin GAJIAN bulan berjalan dari `gajiBulan()` (sumber halaman Gaji): satu ruas per orang bergaji, hijau dibayar / amber belum. Buku upah menulis dasar hitungannya ("fee design Rp… × 10%"). 29 cek alur **Putaran berikutnya ("sudah oke tapi tingkatkan lagi"):** slip jadi slip kertas sungguhan — NOMOR amplop/slip `GJ-YYMM-INISIAL` (diturunkan dari bulan + nama, bukan nomor urut karangan) di amplop dan kop slip; subtotal gaji/fee yang mengulang rincian dibuang, diganti "Total diterima" + TERBILANG (`lib/terbilang.ts`: "seribu" tapi "satu juta", "sebelas", miliar — 14 kasus diuji) + kolom TANDA TANGAN "Dibayar oleh {studio} / Diterima oleh {nama}" dengan CAP keadaan gaji dibubuhkan di atas kolom pembayar. Riwayat 12 bulan mendapat GARIS RATA-RATA putus (rata-rata 12 bulan, bulan kosong ikut) dan angkanya di kepala riwayat; posisinya `bottom: calc(18px + --byt-rata)` — 18 = padding bawah + label bulan + celah. Amplop mini yang dibuka di rak ikut bertutup segitiga. Di 1288–1408 kertas dipadatkan supaya slip tanpa fee sampai ke tepi sobeknya; slip BERFEE memang lebih panjang dan menggulir di dalam slotnya (terukur Juni: 59px di 1440, 51px di 1366). 34 cek alur **Koreksi pemilik "tidak ingin ada text menimpa designnya" (jebakan #70):** amplop mini di rak tanpa segitiga; tutup amplop besar jadi pita 34px dan isi mulai di bawah ujungnya; segel 60px berpusat tepat di ujung tutup; rincian gaji·fee dan cap sebaris supaya amplop tetap 237px (sebelumnya 244) dan slip Oktober tetap 0 gulir; cap tanda tangan `top: 20px`, tanggal tanpa tahun supaya muat di kolomnya |
| **Tagihan & Termin = PAPAN JADWAL TERMIN + PAPAN JEPIT SURAT TAGIHAN, bukan frame 16 lagi** | Permintaan pemilik "lanjut tagihan & termin", sesudah Buku Kuitansi Fee di-ACC. Judulnya menyebut dua benda, jadi halamannya memuat keduanya — sengaja berbeda dari Fee Proyek (kuitansi = bukti SESUDAH dibayar; tagihan = surat SEBELUM dibayar). (1) **Papan jadwal** di bidang `--kas-dalam` yang terbenam di papan `--kas-bidang` berjahit: satu lajur per kontrak (kode inisial `lib/nomorDokumen`, judul, "1/3 lunas"), kisi enam bulan (dua ke belakang, empat ke depan, digeser ‹ ›, label = kembali ke bulan ini), garis HARI INI mint, dan PAKU termin di tanggal tenggatnya — lunas mint bercentang, terbit bergaris terang, lewat tempo amber, draf putus; termin tanpa tenggat di kolom sendiri. Garis lajur bermint sampai paku lunas terakhir. Paku pejal: kisi dan garis berhenti di tepinya. Letak paku diukur dari lebar rel (ResizeObserver, bukan saat menggulir) lalu yang bertabrakan digeser seperlunya (`tataPaku`) — tanpa itu paku yang tenggatnya berdekatan saling tindih di 1024 dan ponsel. (2) **Papan jepit** dengan klip logam dan SURAT TAGIHAN putih tetap (tinta `--kas-bidang`): kop studio (Info Studio, dibaca saja), "TAGIHAN No. TG-{KODE}-{NN}" + "termin N dari M", formulir dua kolom berlabel di atas (Kepada = klien proyek, Proyek, Termin, Jatuh tempo + sisa hari), Jumlah tagihan, terbilang, dan RUANG CAP tempat bertindak: draf → "Terbitkan ke klien", terbit → "Tandai lunas" (cap LUNAS `capLunas.tsx` dibubuhkan di tempat itu, tanggal dari `paid_at`), lewat tempo → cap persegi amber "LEWAT TEMPO n hari" + Tandai lunas; cap LUNAS diklik = batalkan (dialog kit), seperti cap DITERIMA Buku Gaji. Menu ⋯: Kembalikan ke draf, Batalkan lunas, Catat uang masuk (`/admin/keuangan/terima?proyek=`), Buka proyek, Hapus termin. Tumpukan lembar di bawah surat = termin lain di kontrak itu. (3) **Lembar kontrak** (kertas Gaji): nilai kontrak, MISTAR per termin di lintasan gelap tetap + arsir sisa yang belum masuk termin, ringkasan lunas/menunggu/draf, daftar termin (menggulir di lembarnya), jumlah bergaris ganda + persen kontrak; "+ Termin" memilihkan proyeknya. Kop papan: Menunggu dibayar klien (jumlah terbit), Lewat tempo (diklik = buka yang tertua), Lunas bulan ini, Belum diterbitkan. SATU-SATUNYA 3D: surat yang dipilih JATUH ke papan jepit dari engselnya di klip (rotateX dari tepi atas, 480 ms, perspektif 2000) — hanya saat pilihan berubah, diam bila gerak dikurangi; cap "tercap" sekali saat dibubuhkan. Pilihan bawaan = paling mendesak (lewat tempo tertua → terbit terdekat → draf → lunas terbaru); `?termin=` dan `?proyek=` (menu Satu Proyek kini membawa proyeknya). Papan ketik: ←/→ termin sekontrak, ↑/↓ lajur tetangga (tenggat terdekat), Home/End; paku ber-tabindex keliling. Yang dibuang dari versi frame 16: tab status, kotak cari, saringan proyek, paginasi, dan hapus massal lewat centang (hapus kini satu per satu dari menu surat, fokus kembali ke paku kontrak yang sama). Tanpa migrasi dan tanpa endpoint baru. `kodeProyek`/`inisial` pindah ke `lib/nomorDokumen.ts` dan cap LUNAS ke `components/admin/capLunas.tsx` (berawalan kelas per halaman) — Fee Proyek terbukti identik piksel demi piksel sesudahnya. API tiruan kini menangani PATCH tagihan seperti Worker (label, nominal, tenggat, `paid_at` ikut status). Terukur: 0 gulir dokumen/isi pada 1440x790 & 1366x768 (lajur 26px di 1288–1408 supaya kaki surat muat), 0 geser di 390, kontras bersih kedua tema di empat keadaan surat, audit tumpang-tindih 0 di 6 konfigurasi termasuk paku bertindih, 50 cek alur, 8 muat tanpa galat. Catatan alat: audit tumpang-tindih sempat BUTA pada garis 1px karena syaratnya `> 1` piksel — tidak pernah terpenuhi oleh garis selebar 1px (jebakan #36); syaratnya kini `> 0,5`, dan dibuktikan merah 35 temuan saat kisi sengaja digeser ke kolom nama kontrak |
| **Kas Studio = MESIN KAS STUDIO: layar saldo, tuts kategori, rol struk bersaldo berjalan, tabung target** | Permintaan pemilik "lanjut kas studio", sesudah Tagihan & Termin di-ACC. Benda dunia nyatanya mesin kas / buku kas kecil: uang di LUAR proyek keluar-masuk lewat laci, dan tiap gerakannya meninggalkan BUKTI KAS bernomor di gulungan struk — sengaja berbeda dari Gaji (buku), Fee (kuitansi), dan Tagihan (papan jepit). Satu papan `--kas-bidang` berjahit, tiga kolom (`--ksr-mesin` 336 / struk / `--ksr-target` 316; 304/280 di 1288–1408): (1) **MESIN** — layar `--kas-dalam` dengan saldo seluruh catatan (amber kalau minus) + masuk/keluar bulan berjalan; dua TUTS BESAR "Uang masuk"/"Uang keluar" yang membuka dialog bukti; tuts KATEGORI per arah yang memuat jumlah dan banyaknya catatan pada rentang terpilih, dan sekaligus SARINGAN (`aria-pressed`; judul kelompok menyaring seluruh arah); tuts rentang Bulan ini / Semester (bawaan) / 12 bulan / Semua. Tuts bertepi bawah tebal dan turun 2px saat ditekan. (2) **ROL STRUK** — kertas putih tetap bertepi bergerigi (`mask` zig-zag) keluar dari celah printer: kop (judul, nama studio dari Info Studio dibaca saja, rentang + jumlah catatan, cari, keping lepas saringan), per BULAN dengan subtotal masuk/keluar, tiap baris = tanggal, NOMOR BUKTI `BKM-YYMM-NN`/`BKK-YYMM-NN` (diturunkan per arah per bulan menurut urutan kronologis — bukan nomor karangan), keterangan, nominal bertanda, dan SALDO BERJALAN; kaki = saldo awal rentang atau "*** awal catatan kas ***". Klik baris = buka buktinya (ubah/hapus dua langkah). Judul bulan di kertas dikunci ke tinta struk — `h3` global jadi putih di tema gelap (kontras 1,00 sebelum dikunci). (3) **TABUNG TARGET** semester (`useKemajuanTarget`, sumber yang sama dengan kartu Target di Dashboard): tabung berskala maks(target, tercapai), isi bertumpuk pembayaran klien + kas masuk, takar 25/50/75 berlabel di luar tabung, garis target, dan garis amber putus SEHARUSNYA = target × bagian semester yang sudah lewat; angka di bawahnya, tautan "Ubah target" dan target semester berikutnya (`DialogTarget`). SATU-SATUNYA gerak: catatan baru DICETAK — baris muncul dari celah printer (`clip-path`, 640 ms) sementara gulungan di bawahnya terumpan turun 46px; hanya saat menyimpan catatan baru, tidak saat muat, diam bila gerak dikurangi. `.tgt` tetap di `kas-kit.css` karena dipakai Dashboard; `daftar-kit.css` tidak lagi dimuat halaman ini. Tanpa migrasi dan tanpa endpoint baru. ≤1288 dua kolom dengan tabung turun selebar papan, ponsel bertumpuk dan struk tidak menggulir sendiri. Terukur: 0 gulir dokumen/isi pada 1440x790 & 1366x768 (struk menggulir di dalam rolnya), 0 geser di 390, kontras bersih kedua tema, audit tumpang-tindih 0 di 4 lebar (terbukti merah 13 temuan saat takar dan struk sengaja digeser), 31 cek alur, 8 muat tanpa galat. **Putaran "upgradeee" (pandangan pertama + gerak, di dalam benda yang sama):** (1) mesin jadi BENDA BERBADAN — bidang lebih terang bersudut 18 di atas papan, tuts bermuka cekung (gradien atas lebih terang); (2) LAYAR VFD TUJUH-SEGMEN (`Angka7`): sepuluh sel, segmen mati digambar sebagai "8" hantu, yang nyala berpijar mint (amber bila saldo minus), titik ribuan rupiah jatuh di titik desimal sel — dua `<path>` saja; penanda SALDO/MASUK/KELUAR + rentang menyala menurut yang tampil; (3) layar BERPERILAKU seperti mesin kas: tuts kategori yang ditekan menampilkan jumlah kategori itu ("Operasional · 2×"), judul kelompok menampilkan jumlah satu arah, dan angkanya BERHITUNG ke nilai baru (`useHitung`, 520 ms; tidak saat pertama tampil, seketika bila gerak dikurangi); (4) LACI KAS di dasar mesin (muka berpegangan + kunci, kaki mesin di bawahnya sebagai ruang tempuh 30px) yang TERBUKA saat catatan baru dicetak — muka turun dan membesar 3,5%, baki bersekat tampak (lembar mint per kategori masuk = banyaknya catatan, maks. 5, plus sekat koin), badan mesin tersentak sekali — lalu menutup sendiri sesudah 1,3 detik; disentuh tetikus = bergeser 3px; (5) printer berjendela dengan GULUNGAN kertas dan lampu siap mint. Tiga tuts masuk sebaris kini `flex: 1 1 auto` (lebar mengikuti isi) — dibagi rata, "Penjualan material" dan nominalnya terpotong sesudah mesin diberi badan. Kolom mesin 352 (340 di 1288–1408, target 262). Tuts bergradien juga menulis `background-color`-nya: `kontras.mjs` hanya membaca warna dasar, dan tanpanya "Uang masuk" terbaca 1,00 padahal tampil benar (jebakan #36). Terukur: 0 gulir pada 1440x790 & 1366x768, 0 label terpotong di 5 lebar, kontras bersih, audit tumpang-tindih 0 (terbukti merah 8 saat pegangan laci digeser ke tulisan), 37 cek alur |
| **Semua Transaksi = REKENING KORAN STUDIO di kertas continuous form, bukan frame 13 lagi** | Permintaan pemilik "sekarang semua transaksi", sesudah Kas Studio di-ACC. Benda dunia nyata untuk "semua uang yang keluar-masuk, berurut, dengan saldonya" adalah rekening koran: cetakan dot-matrix di kertas CONTINUOUS FORM — sengaja berbeda dari Gaji (buku), Fee (kuitansi), Tagihan (papan jepit), dan Kas (struk mesin kas). Papan `--kas-bidang` berjahit, dua kolom (`--rko-sampul` 300 / kertas; 276 di 1288–1408). (1) **KERTAS**: putih tetap, PITA HIJAU tiap baris kedua (green-bar), JALUR LUBANG TRAKTOR di kedua margin (radial-gradient sewarna papan) dipisah perforasi tegak putus-putus — semua di padding 32px, tidak ada tulisan di atasnya; ujung lembar sebelumnya mengintip di atas, lipatan berikutnya bertumpuk di bawah. Kop: nama studio (Info Studio, dibaca saja) + "REKENING KORAN" + kotak Periode/Lembar/Mata uang. Kolom Tgl · Sandi (KLIEN pejal / BIAYA / KAS putus) · Keterangan (nama + jenis·orang·catatan) · Proyek · Mutasi (angka + CR/DB, CR bermint) · SALDO BERJALAN seluruh catatan ketiga sumber. (2) **URUTAN KRONOLOGIS NAIK** seperti rekening koran sungguhan, dipotong per lembar DARI BELAKANG supaya lembar terbaru penuh, dan yang dibuka lembar terbaru; tiap lembar diawali baris pembuka setinggi baris biasa — "Saldo awal" (lembar 1), "Pindahan dari lembar N" (saldo sebelum baris pertamanya), atau "Diurutkan menurut …" — supaya ruang yang diukur sama di semua lembar (tanpa itu baris per lembar berubah antarlembar dan halaman meloncat). Kaki lembar: mutasi lembar ini, "bersambung ke lembar N", dan SALDO AKHIR bergaris ganda di lembar terakhir. (3) **Baris per lembar = ruang yang ada**: `ResizeObserver` di wadah baris HANYA saat kerangka satu-layar berlaku (`(min-width:1288.02px) and (min-height:600px)`); di bawahnya 12 tetap (mengukur wadah yang tingginya mengikuti isinya sendiri = putaran umpan balik). (4) **SATU-SATUNYA gerak 3D: lembar TERLIPAT di perforasi atasnya** — maju = lembar lama terangkat ke belakang (`rotateX(0→-90deg)`), mundur = lembar sebelumnya turun dari belakang menutupinya (`-90deg→0`); 520 ms, perspektif 2600, salinan lembar `inert` di atas lembar dasar. Sudut NEGATIF wajib: yang positif membawa tepi bawah ke arah mata dan lembarnya membesar keluar papan (terukur dari video). Diam bila gerak dikurangi. Papan ketik: PageUp/PageDown di mana saja kecuali isian/dialog/menu. (5) **Sampul kiri**: saldo akhir periode besar (amber bila minus) + saldo awal, kredit n×, debet n× (tersaring); GRAFIK MUTASI per bulan (≤12 batang, kredit naik mint / debet turun) yang TERSOROT DUA ARAH dengan baris lembar (tetikus saja) dan menjawab "berapa" lewat `KartuGrafik`; cari; saringan Periode (Bulan ini/3/12/Semua, bawaan 12), Mutasi (Semua/Kredit·CR/Debet·DB), Sumber BARU (Klien/Biaya/Kas berjumlah), Proyek (`PilihMenu`, termasuk "Kas studio"); Unduh CSV / Salin (bertab) dengan "n dicentang · lepas". Fitur lama dibawa semua: `?jenis=`, urut kolom (klik ke-3 kembali kronologis), centang → ekspor yang dicentang, bukti pembayaran (`DialogBukti`), rincian & hapus biaya (`DialogBiaya`), kas → Kas Studio. Yang DIBUANG: pemilih "Menampilkan 12" (lembar kini selebar ruangnya) dan urut menurut Penerima (penerima ada di keterangan dan bisa dicari). Kotak centang memakai `.k-centang` kit dengan token yang DIKUNCI ke kertas — kotak bawaan peramban tergambar gelap pekat di atas kertas putih tema gelap. `.trx__*` di `transaksi-kit.css` tetap hidup untuk tabel transaksi Semua Proyek; halaman ini tidak lagi memuatnya. Tanpa migrasi dan tanpa endpoint baru. Terukur: 0 gulir dokumen/isi/sampul pada 1440x790, 1366x768, 1300x760, 1440x900; 0 geser di 390; 0 label terpotong di 6 ukuran; kontras bersih kedua tema (ikon cari kit sempat 1,24 di papan); audit tumpang-tindih 0 di 6 konfigurasi (terbukti merah 73 saat margin kertas dipersempit); 49 cek alur termasuk kesinambungan saldo antarlembar, hapus biaya, ekspor yang dicentang, dan 8 muat tanpa galat. Catatan alat uji: seluruh baris bisa diklik (`::after` tombol keterangan), jadi `hover()` ke sel lain di baris itu terhalang — arahkan ke barisnya. **Putaran "ditingkatkan lagi" (pandangan pertama + gerak, di dalam benda yang sama):** (1) kartu saldo dan grafik bulanan di kiri diganti TUMPUKAN LIPATAN — seluruh cetakan terlipat zig-zag, satu lipatan per lembar (gradien terang→gelap dan gelap→terang berselang = lipatan gunung/lembah, lubang traktor di kedua tepi) dengan rentang tanggal, batang kredit/debet, dan saldo akhir lembarnya (`formatRupiahRingkas`); yang terbuka TERTARIK keluar 12px ke arah kertas berpita mint, disentuh tetikus bergeser 5px, diklik = buka lembarnya (menggantikan titik paginasi); kartu keterangan per lipatan; tumpukan yang lebih panjang dari tempatnya menggulir sendiri dengan tepi memudar (`is-gulir`) dan lipatan terbuka dijaga kelihatan. Datanya dari potongan YANG SAMA dengan lembarnya. (2) Ringkasan periode DICETAK di kop kertas sebagai kotak empat sel (Saldo awal · Mutasi kredit n× CR · Mutasi debet n× DB · Saldo akhir bergaris ganda berpita), judul "REKENING KORAN" 26px; kepala kiri jadi "Tumpukan lembar · N lembar · M mutasi". (3) STABILO: mencentang = pita mint berujung lembut disapukan kiri→kanan (320 ms, sekali, hanya untuk baris yang BARU dicentang — `coret`), di bawah tulisan lewat `isolation: isolate` + `::before` z-index −1. (4) Lembar yang terlipat ikut meredup (`brightness` 1→0,78). Baris 36px di kerangka satu layar (9 baris pada 1440x790). **Cacat yang ketahuan dan ditutup:** kaki lembar terakhir (saldo akhir bergaris ganda) beberapa piksel lebih tinggi dari kaki lembar lain, jadi ruang baris berubah tiap pindah lembar, banyaknya baris per lembar meloncat 8→9→8, dan lembar KEMBALI ke bawaan tepat saat lipatan selesai — kaki kini 40px tetap; cek alur baru memastikan tiap lipatan yang diklik tetap di lembarnya. Latar lipatan gradien juga menulis warna dasar (alat kontras membaca papan → 1,00, jebakan #36). Terukur: 0 gulir/0 terpotong di 6 ukuran, kontras bersih, audit tumpang-tindih 0 (terbukti merah 104 saat padding lipatan dipersempit), 54 cek alur. **Grafik mutasi per bulan DIKEMBALIKAN atas permintaan pemilik** ("ini boleh tambahkan juga"): di kolom kiri di antara tumpukan lipatan dan cari, 62px (sebelumnya 76) dengan judul "Mutasi per bulan", sorot dua arah dengan baris lembar dan `KartuGrafik` seperti versi pertama; lipatan boleh menyusut ke 19px supaya sembilan lipatan tetap muat di 1440x790 (sepuluh lipatan di 1366 menggulir dengan tepi memudar). Di ≤1288 grafik mendapat area sendiri di bawah tumpukan. Catatan alat: audit tumpang-tindih sempat menghitung jalur lubang lipatan yang sudah TERGULIR KELUAR dari kotak tumpukan — tidak tergambar, tapi kotaknya menindih "10 lembar · 73 mutasi" (jebakan #36); kotak hiasan kini dipotong ke bagian tampak kotak gulirnya. Terukur: audit 0 (terbukti merah 72 saat label bulan didorong ke garis nol, 98 saat padding lipatan dipersempit), kontras bersih, 57 cek alur |
| **Catat Pengeluaran = BUKU NOTA PENGELUARAN + PAKU NOTA, bukan frame 10 lagi** | Permintaan pemilik "lanjut catat pengeluaran", sesudah Semua Transaksi di-ACC. Benda dunia nyata untuk mencatat uang yang keluar untuk proyek adalah buku NOTA rangkap di meja studio, dan nota yang sudah ditulis DITUSUK ke paku nota — sengaja berbeda dari Gaji (buku), Fee (kuitansi), Tagihan (papan jepit), Kas (mesin kas), dan Semua Transaksi (rekening koran). Papan `--kas-bidang` berjahit, tiga kolom (`--npg-rak` 272 / buku / `--npg-paku` 300; 248/272 di 1288–1408): (1) **RAK CAP** — empat cap karet kategori (`cost_category`) bergagang, muka karetnya memuat jumlah + banyaknya nota BULAN INI; yang dipilih turun 2px bertinta mint dan dibubuhkan sebagai cap persegi berbingkai ganda di lembar nota. Di bawahnya daftar PENERIMA per jenis anggota dengan cari (membuka kelompok yang punya hasil) dan tautan ke Tim & Freelancer. (2) **BUKU NOTA** — jilid gelap berstaples, lembar putih tetap berperforasi, nomor `NP-YYMM-NN` (urutan biaya dalam bulan terjadinya menurut tanggal lalu urutan catat — pola nomor bukti Kas; nota bertanggal lama terselip di urutannya), isian di garis titik-titik (tanggal `PilihTanggal`, proyek dan "Dibayar kepada" `PilihMenu` berpemicu tulisan, keperluan), kotak Rp berbingkai ganda, TERBILANG yang ikut diketik, ruang tanda tangan Penerima/Pembayar (nama studio dari Info Studio, dibaca saja); dua lembar rangkap mengintip di bawahnya. Tombol mati menyebut alasannya. (3) **KONTROL PROYEK** — nilai kontrak, sudah keluar, dan SESUDAH NOTA INI yang bergerak saat jumlah diketik (meteran beban + ruas arsir nota ini; amber bila melewati kontrak). (4) **PAKU NOTA** — delapan biaya terbaru: yang terbaru utuh di puncak dengan ujung paku menembus lubangnya, tujuh lainnya menyembul 31px di bawahnya, batang paku hanya di celah antara tumpukan dan alas (jebakan #70). Klik = `DialogBiaya` (rincian/hapus). SATU-SATUNYA gerak: sesudah tersimpan, nota DISOBEK dari perforasinya (terangkat + `rotateX` 14°), TERBANG ke paku sambil mengecil selebar nota paku (jarak dibaca SEKALI saat menyimpan), lalu MENDARAT di puncak tumpukan sementara tumpukan turun memberi tempat; lembar kosong berikutnya sudah ada di buku. 780 ms, diam bila gerak dikurangi. Nota baru langsung disisipkan ke daftar (tersembunyi sampai mendarat) lalu daftar segar menggantinya. Fitur lama dibawa semua: kategori, penerima boleh kosong, proyek tersinkron `proyekAktif`, tanggal maks hari ini, Kosongkan, toast, rincian & hapus, "Lihat semua" ke Semua Transaksi keluar, menu ⋯ (Semua transaksi/Fee/Gaji), kunci cache yang sama. `keluar-kit.css` dibuang; API tiruan kini menangani `POST /admin/costs` dan mengurutkan `/admin/costs` seperti Worker. ≤1288 buku selebar papan di atas, rak dan paku berdampingan; ponsel bertumpuk. Tanpa migrasi dan tanpa endpoint baru. Terukur: 0 gulir dokumen/isi pada 1440x790, 1366x768, 1300x760, 1440x900; 0 geser di 390; 0 teks terpotong di 7 ukuran dalam keadaan terisi (tanggal sempat terpotong di 1300 saat cap "OPERASIONAL" dipilih — cap dipadatkan di rentang 1288–1408); kontras bersih kedua tema; audit tumpang-tindih 0 di 6 konfigurasi (terbukti merah 17 saat padding lembar dan nota dipersempit); 38 cek alur termasuk nomor, isi tersimpan, mendarat di paku, hapus dari paku, dan 8 muat tanpa galat. **Putaran "tingkatkan lagi" (pandangan pertama + gerak, di dalam benda yang sama):** (1) lembar jadi NOTA KONTAN BERCETAK — dua tinta: formulir dicetak hijau (`--npg-cetak`, campuran `--kas-bidang` + mint) dan tulisan yang diisi bertinta gelap (`--kas-dalam`); bingkai cetak ganda di padding lembar, judul "NOTA" 32px berspasi lebar, TABEL Keterangan | Jumlah (Rp) dengan baris kosong tercetak setinggi ruang yang ada (garis 30px sebagai latar sel kosong, garis kolom di TEPI sel), baris JUMLAH Rp berpita, "Terbilang" di garis titik, tanda tangan Penerima / Hormat kami. Keperluan dan nominal kini diisi di baris tabel (id `npg-label`/`npg-nominal` tetap). (2) SISA SOBEKAN bergerigi di bawah jilid — satu lapis per nota bulan ini (maks. 6). (3) Gerak: salinan yang disobek bertepi atas BERGERIGI (mask) dan ditarik miring sebelum terbang, paku TERSENTAK saat nota menancap (tumpukan memampat, alas bergetar), cap kategori TERCAP sekali saat dipilih (bukan saat muat). (4) Paku berbadan: batang logam 6px berkilap, alas cakram berbibir, nota teratas miring −1,2° berporos di lubangnya. Ekor spasi huruf "NOTA" sempat menyentuh bingkai kanan (audit, bukan tinta) — margin negatifnya dikurangi. Terukur: 0 gulir/0 terpotong di 7 ukuran, kontras bersih, audit tumpang-tindih 0 termasuk bingkai cetak dan sisa sobekan (terbukti merah 55), 38 cek alur. **Putaran "1000000x" (pemilik: "jangan biasa aja seperti ini"):** (1) PAKU jadi tumpukan nota sungguhan — tiap nota lama tertusuk di TENGAHNYA: lembar 44px bergrid `1fr 26px 1fr` (kolom tengah sengaja kosong; batang logam 6px + lubang sobek digambar di situ, jadi batangnya tampak menembus seluruh tumpukan tanpa lewat di belakang tulisan), miring tetap per urutan (`MIRING`) berporos di lubangnya, yang lebih baru di atas (`z-index: 20 − i`; nota teratas 30). Baris kiri: tanggal · nomor NP tercetak + keterangan; kanan: nominal. ALAS paku = cakram logam + PELAT berisi total biaya bulan ini dan banyaknya nota; angkanya BERHITUNG (`useHitung` lokal, 600 ms) dan baru bertambah saat nota MENANCAP, bukan saat disobek. (2) CAP KARET berbadan: kenop bulat, leher, balok kayu di atas muka karet; seluruh cap turun 3px saat dipilih, naik 3px saat disentuh tetikus. (3) BUKU berisi 50 lembar: jilid berlabel "Buku {bulan} · lembar N dari 50", TEBAL tumpukan lembar di bawahnya = 4px + 0,24px × sisa lembar (menipis satu lembar tiap nota). (4) Gerak: disobek dari KANAN ke kiri (sudut kanan terangkat dulu), MELAYANG 96px di atas ujung paku sambil mengecil, lalu DITUSUK turun lurus; paku dan ujungnya tersentak, sisa sobekan bertambah satu lapis. 1000 ms, diam bila gerak dikurangi. **Cacat yang ketahuan audit:** nota teratas ber-z-index 3 sementara tumpukan 20 — bagian bawahnya tertutup; dan urutan tumpuk terbalik (yang lama menutupi yang baru). **Alat audit sempat salah model dua kali (jebakan #36):** wilayah "tertutup nota di atasnya" diberlakukan ke tulisan nota di atas itu sendiri, dan batang paku nota yang sudah tergulir keluar dari kotak tumpukan ikut dihitung menindih pelat. Sekarang wilayah penutup hanya berlaku untuk tulisan milik nota yang tertutup, dan kotak batang dipotong ke bagian tampak. Terukur: 0 gulir/0 terpotong di 7 ukuran, kontras bersih, audit 0 (terbukti merah 14 tanpa ruang atas nota, 18 tanpa kolom batang), 44 cek alur termasuk pelat = total bulan, pelat bertambah sesudah menancap, dan buku menipis |
| **Terima Pembayaran = KOTAK KARTU PEMBAYARAN KLIEN, bukan frame 07 lagi** | Permintaan pemilik "acc lanjut terima pembayaran", sesudah Catat Pengeluaran di-ACC. Benda dunia nyata untuk MENERIMA uang klien bertahap adalah kartu pembayaran (kartu angsuran/SPP): satu kartu karton bergaris per proyek, disimpan di kotak kartu, ditarik saat klien membayar, ditulis satu baris, diparaf — sengaja berbeda dari Gaji (buku), Fee (kuitansi), Tagihan (papan jepit), Kas (mesin kas), Semua Transaksi (rekening koran), dan Catat Pengeluaran (nota + paku). Papan `--kas-bidang` berjahit, dua bagian (`--kpb-kotak` 292 / kartu; 258 di 1288–1408). (1) **KOTAK KARTU**: bagian dalam gelap, puncak kartu urut ABJAD berdiri di DASAR kotak (`margin-top: auto` di kartu pertama — bukan `justify-content: flex-end`, yang memotong awal isi saat menggulir), tab indeks berselang kiri/tengah/kanan (posisi = urutan abjad mod 3, dan tab kartu di meja memakai posisi yang SAMA), nama, klien, sisa, dan meteran tipis bagian yang sudah dibayar; kartu lunas lebih pudar; slot kartu yang sedang di meja diisi KARTU PENGGANTI bermint "Di meja" (kebiasaan arsip sungguhan); muka kotak berlabel bingkai logam berisi seluruh piutang + banyaknya kartu, dengan pegangan. Badan tiap kartu (`::after`) turun di balik kartu di depannya, jadi pita tab hanya memperlihatkan permukaan polos (jebakan #70). (2) **KARTU di meja**: karton mint pucat TETAP (`--kpb-karton`), dua tinta (cetak hijau / tulis gelap) + pensil, kop "KARTU PEMBAYARAN" + No. `KP-{KODE}` (`kodeProyek`) + nama studio (Info Studio, dibaca saja) + kotak nilai kontrak, identitas (Proyek = `PilihMenu` berpemicu tulisan, Klien, Kota · jenis), BUKU BARIS berurut waktu dengan SISA BERJALAN dan paraf bercincin rangkap berinisial penerima (klik baris = bukti), garis kolom tercetak sebagai SATU lapis di atas seluruh tinggi buku (jadi baris kosong tetap berkolom), BARIS YANG SEDANG DITULIS distabilo dengan isian jumlah bertitik ribuan dan sisa yang bergerak, kotak centang tercetak "Pembayaran ini" (tebakan = centang PENSIL putus, pilihan staf = TINTA) dan "Lewat" (radio ARIA, panah kiri/kanan), Diterima oleh, Catatan, terbilang, kaki (jumlah diterima n×, mistar kontrak 0–100 dengan arsir jumlah yang sedang diketik, sisa + persen masuk, slot cap LUNAS), lubang batang kotak kartu di pita bawah. SATU-SATUNYA 3D: kartu yang diklik di kotak DITARIK — berdiri di slotnya (`rotateX(-72deg)`, poros tepi bawah, diskala selebar slot) lalu rebah di meja, 640 ms; jarak tengah-bawah ke tengah-bawah dibaca sekali saat klik dan dipasang di `useLayoutEffect` sesudah kartu baru terpasang (`key` = id proyek). Kotak kiri WAJIB `isolation: isolate`: tanpa itu z-index kartu di kotak dan muka kotak (60) bocor ke papan dan kartu yang ditarik lewat di BELAKANG kotak (terlihat di video). Sesudah mencatat (2D): baris baru disisipkan langsung, tertulis kiri→kanan (`clip-path` per sel), paraf tercap, angka kaki berhitung (`useHitung` lokal yang MELOMPAT saat kartu berganti — angka proyek lain bukan "bertambah"), cap LUNAS dibubuhkan bila sisa habis, dan bukti pembayaran terbuka sesudah 1,1 detik (seketika bila gerak dikurangi). Baris kartu baru diambil dari cache di render yang sama dengan pergantian kartu — tanpanya satu frame menggambar baris proyek lama di bawah kop proyek baru. Fitur lama dibawa semua: empat metode, tebakan jenis lama, `?proyek=` lalu proyek aktif, cari (judul/klien/kota), Saring → Semua Proyek, Proyek Baru, ringkasan kontrak (kini di kop dan kaki), diterima oleh, catatan, Kosongkan, bukti otomatis dan dari tiap baris, "Semua uang masuk", menu ⋯ (tombol polos — jebakan #71). Tanpa migrasi dan tanpa endpoint baru; `bayar-kit.css`, `terima-kit.css`, dan selektor `.tr__*` di `kit.css` dibuang. ≤1148 kartu selebar papan di bawah kotak (kotak memuat semua kartu tanpa gulir), ponsel menyembunyikan kolom Sisa (ada di kaki). Terukur: 0 gulir dokumen/isi pada 1440x790, 1366x768, 1300x760, 1440x900; 0 geser di 390; 0 teks terpotong/meluber di 7 ukuran dalam keadaan terisi; kontras bersih kedua tema; audit tumpang-tindih 0 di 7 konfigurasi (terbukti merah 100 saat padding dirusak; kotak hiasan dipotong ke bagian tampak kotak gulirnya — cap paraf yang tergulir di bawah kepala kolom sempat terhitung, jebakan #36); 60 cek alur termasuk sisa berjalan, tebakan pensil→pelunasan, pilihan staf bertahan, tersimpan benar, bukti otomatis, tarik kartu, cap LUNAS, dan 8 muat tanpa galat **Putaran "10000000x" (pandangan pertama + gerak, di dalam benda yang sama):** (1) KOTAK jadi kotak sungguhan — bibir belakang 7px, dinding belakang menggelap ke atas, dinding samping trapesium (`clip-path`, sempit di belakang), dan PERSPEKTIF DATAR: tiap kartu yang lebih ke belakang 2px lebih sempit per sisi dan sedikit lebih gelap (`--kpb-dalam`, dibatasi 6; tanpa transform 3D); KARTU PEMISAH HURUF (karton tekan abu, tab huruf di kanan) sebelum kartu pertama tiap huruf awal — hanya saat tidak mencari; label muka kotak bersekrup. Deret yang lebih panjang dari kotak digulir ke DASARNYA saat dimuat (kotak dilihat dari depan) dengan kartu "Di meja" dijaga tampak — tanpa itu kartu depan tertutup muka kotak (terukur di 1300x760). (2) Kartu di meja: pita cetak di tepi atas, SUDUT KANAN ATAS TERPOTONG seperti kartu arsip, tebal karton dua tepi + bayangan, serat halus, tab kartu pejal bertinta cetak, judul 26px, kotak "No. kartu" besar di samping nilai kontrak, kaki ber-angka 24px dan MISTAR BERGERIGI (5%/25%) dengan PENANDA persen yang meluncur ke posisi SESUDAH jumlah yang sedang diketik. (3) Benda yang menyenangkan disentuh: puncak kartu di kotak DIANGKAT 24px (tetikus saja; juga fokus papan ketik) dan badan kartunya memperlihatkan "terakhir {tgl} · {Rp} · n× bayar" dari `semuaPembayaran()` (kunci `bayar-semua` dibaca saja, jebakan #8); badan itu `visibility: hidden` saat diam — alat audit dan pemindai terpotong melewati teks tersembunyi. (4) Gerak TUKAR KARTU: kartu lama DIKEMBALIKAN ke slotnya (salinan DOM `cloneNode` tanpa id, `inert`, ditempel di `.kpb__lapis` yang tidak pernah dirender React; 480 ms, poros tepi bawah ke `rotateX(-72deg)`) sementara kartu baru ditarik keluar 230 ms kemudian — keduanya bersilangan; kartu baru selalu di atas salinan. Centang kotak isian tergambar kiri→kanan (`clip-path`). **Cara melihat gerak sependek ini:** rekaman `recordVideo` punya selisih waktu yang berubah tiap rekaman, dan `Animation.setPlaybackRate` CDP tidak menolong karena pengatur waktu JS (`setTimeout` yang mencabut kelas/membuang salinan) tetap berjalan normal dan memotong geraknya — yang bekerja adalah memotret beruntun (`animations: "allow"`, ~120 ms sekali) sesudah klik `noWaitAfter`. Terukur: 0 gulir pada 1440x790, 1366x768, 1300x760, 1440x900; 0 terpotong di 7 ukuran; kontras bersih kedua tema; audit tumpang-tindih 0 termasuk pita, sudut, sekrup, dinding, gerigi, dan pemisah (terbukti merah 7 saat label dilebarkan ke sekrup dan padding kartu dipersempit ke pita); 68 cek alur termasuk pemisah per huruf, intip = pembayaran terakhir, salinan kembali tanpa id ganda dan dibuang sesudahnya |
| **Keuangan — Ringkasan = MEJA GAMBAR: lembar KURVA S + REKAPITULASI — menggantikan timbangan (2×) dan papan bursa** — di-ACC pemilik 7 Okt 2026 (putaran "100000000x", tanpa selotip) | Riwayat penolakannya sendiri pelajaran: timbangan datar dan timbangan presisi dibalas "masih biasa aja … harus BEDA, bukan timbangan"; papan kurs split-flap dibalas "jauh lebih buruk dari yang saya kira … sesuaikan creativitas dengan yang sebelumnya tapi berkaitan dengan ringkasan", lalu arahnya diperjelas: "yang berkaitan dengan architecture". Jadi benda halaman RINGKASAN harus benda yang dipakai DUNIA ARSITEKTUR untuk meringkas keuangan pekerjaan, dalam bahasa papan + kertas yang sudah di-ACC — bukan benda keuangan umum (timbangan, bursa). Jawabannya dua lembar yang di dunia konstruksi selalu berdampingan: KURVA S (time schedule) dan REKAPITULASI (bagian akhir RAB), ditempel selotip kertas di papan gambar hijau berjahit (`--kas-bidang`). (1) **Kurva S**: butirnya PROYEK (kalau satu proyek dipilih lewat `proyekAktif`: TERMIN — Kurva S bentuk aslinya), bobot = nilai kontrak ÷ jumlah kontrak lembar (kontrak = maks(contractValue, jumlah tagihannya)), batang per bulan: RENCANA = tagihan menurut tenggat (lunas tanpa tenggat memakai tanggal lunasnya; draf/terbit tanpa tenggat dihitung "belum berjadwal" di kaki), REALISASI = tagihan lunas menurut tanggal lunas — sumber sama dengan kas masuk Worker. Kurva kumulatif mulai dari bagian yang sudah ditagih/dibayar SEBELUM 1 Januari (jujur untuk proyek lintas tahun); rencana garis cetak putus, realisasi tinta, bagian TERLAMBAT diarsir amber (mask: di bawah rencana dikurangi di bawah realisasi), maju = mint. Baris rekap per bulan: rencana & realisasi kumulatif, deviasi, kas masuk (dari tagihan), beban (catatan bulanan), laba — satuan juta. Lebih dari 8 proyek digabung "Proyek lain". Kop: KURVA S + tahun (PilihMenu kit berpemicu teks; tahun = yang punya tagihan berjadwal/lunas atau catatan bulanan, maks. 4), angka besar REALISASI / RENCANA / TERLAMBAT, dan pita Pekerjaan · Nilai kontrak · Laporan s.d. · Perencana (Info Studio, dibaca saja). (2) **Tanggal laporan** (laporan Kurva S selalu "s.d. bulan ke-n"): bawaan bulan berjalan (Desember untuk tahun lalu); dipilih lewat tombol bulan di kepala tabel (←/→/Home/End, satu tab-stop) atau klik bidang. Realisasi sesudahnya tinggal garis PENSIL dan batangnya abu. (3) **Rekapitulasi** s.d. tanggal laporan: A penerimaan per proyek (4 butir + lainnya), B pengeluaran per kategori biaya + "Tanpa rincian" = selisih terhadap catatan bulanan (daftar `/costs` dibatasi 200 baris), C laba bersih bergaris ganda + terbilang, lalu marjin kas, tertunggak (rencana − realisasi dalam rupiah), piutang kini; ditutup kota + tanggal + nama studio. Benda yang disentuh: SEGITIGA 30/60 akrilik di atas MISTAR bermilimeter, tepi tegaknya garis baca bulan yang ditunjuk tetikus (alasnya ke kanan supaya kurva yang dibaca tidak tertutup, ke kiri di ujung). SATU-SATUNYA gerak: PENA RAPIDO menarik tinta realisasi sampai tanggal laporan baru — hanya saat laporan MAJU atau tahun berganti (dari Januari), mundur seketika, tidak saat dimuat, seketika bila gerak dikurangi. Tinta, arsiran, dan titik dibuka lewat satu lebar potongan yang ditulis langsung ke DOM per bingkai; panjang garis dihitung dari titiknya, bukan dibaca dari SVG. **Pena berjalan di luar siklus efek**: versi pertama membatalkannya di cleanup efek, dan efek ikut terpicu ulang oleh perubahan ukuran bidang sesaat sesudah klik — pena tidak pernah tampak kalau bulan dipilih dari tombol kepala tabel (tes alur yang menangkapnya, bukan mata). Pena dan segitiga hidup di bidang bulan, yang tanpa tulisan, dan dipotong tepinya (jebakan #70). **API tiruan diselaraskan dengan Worker lagi:** tagihan tiruan kini tersebar sepanjang tahun (jumlah lunas = `received` ringkasan, satu terbit lewat tempo, draf tanpa tenggat), dan `bulananTiruan()` = tagihan lunas + biaya saja tanpa angka karangan dasar, bulan kosong tidak muncul — sebelumnya baris kas masuk kurva tidak pernah cocok dengan batangnya. Tanpa migrasi dan tanpa endpoint baru; kunci cache sama. `bursa-kit.css` dibuang. Terukur: 0 gulir dokumen/isi pada 1440x790, 1366x768, 1300x760, 1440x900; 0 geser di 390; kontras bersih kedua tema (angka rencana bulan depan sempat 1,93 — kini tinta redup miring); audit tumpang-tindih 0 di 10 konfigurasi (terbukti merah 291 saat dirusak) — selotip diuji sebagai persegi BERPUTAR, karena kotak luarnya menyentuh judul padahal bendanya tidak (jebakan #36); pena median 16,7 ms per bingkai, 0 animasi tersisa; 40 cek alur termasuk kas masuk & beban per bulan = catatan bulanan API, realisasi kumulatif, A − B = C, rekap ikut tanggal laporan, papan ketik, segitiga tepat di akhir bulan, ganti tahun, mode satu proyek = termin, dan 8 muat tanpa galat. **Putaran "100000000x" (pemilik: "sudah oke banget … jangan ada tape kyk gitu itu buat jadi berantakan … cukup ditingkatkan jangan ganti yang lain"):** di dalam benda yang sama, yang diubah pandangan pertama dan gerak. (1) SELOTIP DIBUANG — kertas kini berbingkai cetak ganda (box-shadow inset 6–10px dari tepi, tulisan mulai 14px) dan dua lembar laporan sebelumnya mengintip di bawahnya; jangan kembalikan hiasan penempel apa pun. (2) Kurva: BASUHAN mint bergradasi di bawah realisasi (ikut dibuka pena), titik laporan berlingkar, garis penunjuk ke sumbu, dan TAG di kolom skala (realisasi pejal, rencana bergaris; label skala yang terlalu dekat disembunyikan). (3) Menyentuh satu butir (baris kurva, atau butir A rekap) menggambar KURVA S MILIK BUTIR ITU (0–100% nilainya, tinta tebal + isi mint) di atas kurva gabungan yang meredup. (4) Pita ARUS KAS 40px di bawah mistar: kas masuk naik / beban turun dari garis tengah, skala bersama, kartu keterangan per bulan. (5) Rekapitulasi: baris C keluar dari tabel jadi BLOK LABA BERSIH — angka besar bergaris ganda, NERACA BATANG (penerimaan terbagi beban | laba, amber berarsir bila rugi) dengan persennya, terbilang; tiap butir A/B membawa GARIS PORSI 2px berjalur di dasar selnya (di bawah tulisan, bukan di belakangnya); Marjin dibuang dari catatan (sudah di neraca), Tertunggak/Piutang dua kolom; tanda tangan sebaris dengan tanggal pendek. (6) Gerak: angka progres, Jumlah A/B, dan laba BERHITUNG (`Hitung`, 560 ms, ditulis langsung ke DOM — tanpa render ulang halaman; tidak saat muat), neraca dan porsi bergeser 420–460 ms, bersama pena. Pita kop kini `auto auto auto minmax(0,1fr)` (nama studio yang mengalah) — di 1300 kolom pecahan memotong nilai kontrak. **Alat ukur sempat salah lagi (jebakan #36):** skrip potong/zoom memotret TANPA `pasangFont`, jadi Urbanist jatuh ke fon cadangan yang lebih lebar dan pita kop terbaca terpotong di semua lebar; dan suntingan yang menambah hiasan baru ke audit tumpang-tindih tidak mengena (baris sasarannya sudah berubah), jadi audit melapor 0 dengan RUSAK — baru dipercaya sesudah terbukti merah 156 (padding kertas dirusak) dan 64 (porsi & batang arus dirusak). Terukur: 0 gulir pada 1440x790, 1366x768, 1300x760, 1440x900; 0 geser di 390; 0 teks terpotong kecuali elipsis bertitle yang disengaja; kontras bersih kedua tema; audit 0 di 10 konfigurasi + keadaan butir disentuh; pena median 16,7 ms; 51 cek alur termasuk C berhitung (di tengah jalan bukan angka akhir), neraca sebanding A/B, porsi A = 100%, batang arus = kas masuk bulanan, kurva proyek muncul/hilang, dan tag sumbu = realisasi |
| **Semua Proyek = RAK ORDNER PROYEK + ORDNER TERBUKA, bukan frame 19 lagi** | Permintaan pemilik "acc, lanjut ke semua proyek". Benda dunia nyata untuk SEMUA proyek studio adalah rak ordner (map proyek): satu ordner per proyek berdiri berderet, yang dikerjakan ditarik lalu dibuka di meja — sengaja berbeda dari kotak kartu (Terima), buku (Gaji), papan jepit (Tagihan), dan lembar gambar (halaman identitas; kop lembar TIDAK dipakai di sini). Papan `--kas-bidang` berjahit, dua baris: (1) **RAK** — urut TAHUN lalu terbit (terbaru kiri) dengan PEMBATAS TAHUN (karton tekan, tahun tegak), ordner pertama = ordner kosong putus-putus "Proyek baru"; punggung 72x176: JENDELA FOTO SAMPUL proyek (`coverImageUrl`; tanpa foto = arsiran + huruf jenis), KANTONG LABEL putih (kode `kodeProyek`, judul tegak `writing-mode`, tahap pipeline), lubang jari, METERAN TEGAK di tepi kiri = bagian kontrak yang sudah dibayar (`scaleY`, bukan tinggi % — `calc(panjang * % / %)` tidak sah); rona punggung tiga tingkat hijau menurut JENIS proyek (rona, bukan warna makna). Ordner yang dibuka tertarik 16px dengan kantong mint; disentuh tetikus = dicungkil keluar (naik 8px, miring −3°). Ujung rak: PAPAN RAK berisi jumlah kontrak seluruh rak, yang sudah masuk, dan berjalan/lunas. Rak menggulir mendatar; ordner terbuka dijaga kelihatan (offset dibaca sekali per pilihan). Klik kanan = pintasan lima halaman proyek (dibawa dari versi lama). (2) **ORDNER TERBUKA** — papan ordner gelap, dua lembar putih tetap, PELAT MEKANISME + dua CINCIN di lipatan (menumpang padding lipatan kedua lembar), lembar kanan berlubang. Kiri LEMBAR RINGKASAN: "Map proyek · KODE", judul 24px, jenis · kota · tahun, status, Buka / Ubah / Terima bayar, klien, Tahap & Fase klien (`PilihTeks`, ubah di tempat), TANGGA TAHAP tujuh anak tangga (dilewati gelap, kini mint), pembayaran diterima angka penuh + bar. Kanan LEMBAR KEUANGAN: arus kas 6/12 bulan (kit `KolomGrafik`, sorot + kartu keterangan) dan transaksi enam terbaru dengan rentang dan URUT KOLOM (`useUrutTabel` + kepala ber-`aria-sort`), "Semua transaksi". SATU-SATUNYA 3D: ordner DIBUKA — lembar kiri adalah kartu dua muka (`preserve-3d`; muka depan isi ringkasan, muka belakang SAMPUL ordner berlabel), mula-mula `rotateY(180deg)` tertutup di atas lembar kanan lalu berayun ke kiri di cincin (poros = tengah lipatan, 760 ms); hanya saat pilihan berubah, tidak saat muat, diam bila gerak dikurangi. Kertas putih tetap mengunci token isinya (`--text-*`, `--border`, `--surface`, `--k-deret-tua`) — TETAPI `--brand` tidak boleh dikunci: lencana pejal kit membaca `--brand` dan aturan tema gelapnya (0,4,0) lalu menggambar hijau-di-atas-hijau (1,00, jebakan #37); lencana, tombol hantu, dan batang "tua" di kertas dikunci sendiri-sendiri dengan kekhususan di atas aturan tema gelap kit. ≤1148 kedua lembar bertumpuk (berdampingan, nama transaksi menyempit jadi satu huruf). Tanpa migrasi dan tanpa endpoint baru; `PilihTeks`/`TAHAP` tetap diekspor `ProyekKit.tsx` untuk Satu Proyek. Terukur: 0 gulir pada 1440x790, 1366x768, 1300x760, 1440x900; 0 geser di 390; 0 terpotong (termasuk judul tegak) di 7 ukuran × 2 proyek; kontras bersih kedua tema; audit tumpang-tindih 0 di 7 konfigurasi (terbukti merah 12 saat padding lipatan dipersempit); 30 cek alur termasuk urutan rak, pembatas tahun, papan rak, meteran punggung, ubah tahap → label punggung dan tangga ikut, urut nominal, klik kanan, `?id=`, dan 8 muat tanpa galat |
| **Fee Proyek = BUKU KUITANSI FEE, bukan lemari laci dan bukan frame 25** — membalik versi lemari laci yang sempat di-ACC | Lemari laci gambar (laci per proyek, perabot 3D utuh) di-ACC lalu ditanya balik pemilik: "kenapa harus laci? … boleh 3d tapi jangan keseluruhan, patokannya ada di gaji" dan "setiap membuat harus sesuai dengan judul". Fee proyek DIBAYAR, dan benda yang dipakai untuk itu di dunia nyata adalah buku kuitansi: satu buku per PROYEK, satu bonggol per pembayaran. Bahasanya bahasa Buku Gaji — papan `--kas-bidang` berjahit, lembar kertas `--brand-soft` 60% + surface bergaris jilid dan lipatan, tumpukan lembar mengintip — supaya keduanya terbaca sekeluarga. Isinya: SAMPUL KIRI (fee keluar pada rentang + jumlah proyek/penerima/porsi dari kontrak, pita 12 bulan, rak BUKU per proyek: kode inisial, nama, fee, MISTAR porsi kontrak per penerima menurut warna jenis + arsir amber tanpa nama, jumlah kuitansi/penerima; buku terbuka bergeser 12px dan bertepi mint); LEMBAR KANAN (kop "Buku kuitansi fee" + nama proyek + kode, rentang/urut/CSV) dengan tiga bagian: BONGGOL — pembayaran fee bernomor urut kronologis, terbaru di atas, dan TAHAP YANG BELUM DIBAYAR (jatuh tempo amber, menunggu putus) sebagai bonggol kosong di puncak; garis SOBEKAN berlubang; KUITANSI — kertas putih tetap berbingkai cetak ganda, tepi kiri bergerigi, "No. FP-{KODE}-{NN}" sama dengan nomor bonggolnya, Telah terima dari (nama studio dari Info Studio, dibaca saja), Uang sejumlah, Terbilang `# … #` (`lib/terbilang.ts`), Untuk pembayaran, tempat & tanggal, tanda tangan penerima dengan CAP LUNAS (inisial studio, tanggal); bonggol kosong menulis "belum ditulis" dan menautkan ke Satu Proyek `#tim-bayaran`; RINCIAN FEE PROYEK — mistar porsi + daftar penerima (peran/persen, diterima, "dari hak" bila belum lunas) yang tersorot dua arah dengan bonggol. SATU-SATUNYA 3D: kuitansi baru terayun masuk dari engsel kiri (`rotateY`, 540 ms) lalu cap dibubuhkan (420 ms kemudian) — hanya saat pilihan berubah, bukan saat muat, diam bila gerak dikurangi. Data tanpa endpoint baru: `feePerProyek`/`feePerOrang`, `semuaBiaya` (nomor kuitansi), `daftarTimProyek` + `daftarBiaya` per proyek saat dipilih atau disentuh. Papan ketik: ↑/↓/Home/End di rak dan di bonggol; `?proyek=<id>`. Yang dibuang dari versi lemari: gulungan, rak kartu dinding, perabot; CSV per proyek dan per orang tetap. `--kas-dalam` tetap dipakai (lintasan mistar & batang penerima). Lebar: ≥1288 satu layar; ≤1288 sampul jadi pita di atas lembar dan grafik bulan mengisi tinggi kolom kirinya (tanpanya ada ruang kosong 250px di 1024); ≤1100 kuitansi lebih dulu, bonggol dalam kotak gulirnya sendiri, lalu rincian; ponsel bertumpuk. Tema gelap: bonggol terpilih memakai mint 14% + garis kiri mint (34% membuat tanggalnya 2,39). Terukur: 0 gulir dokumen/isi pada 1440x790 & 1366x768 (bonggol menggulir di dalam lembar), 0 geser di 390, kontras bersih kedua tema, audit tumpang-tindih 0 di 5 konfigurasi (terbukti merah 31 temuan saat padding kuitansi sengaja dipersempit), 27 cek alur, 8 muat tanpa galat hidrasi |
| **Gaji = BUKU GAJI yang terbuka, bukan frame 25 lagi** — membalik "Gaji dibangun dari frame 25 LAGI" | Permintaan pemilik "sekarang bagian gaji keluarkan crativitasmu". Benda dunia nyatanya buku DAFTAR PENERIMAAN GAJI per bulan — sengaja berbeda dari Bayaran Tim (amplop per ORANG): halaman ini menjawab "bulan ini studio membayar siapa saja, siapa yang sudah menerima". Satu papan `--kas-bidang` (sampul) memuat: SAMPUL DALAM — label tempel berbingkai (keluar untuk orang + tren dari bulan lalu + pecahan gaji/fee), tanda terima gaji (meter mint/amber), dan RAK JILID per tahun yang tinggi bukunya sebanding jumlah tahun itu (klik = buka jilid; jilid lama dibuka di Desember); LEMBAR kertas — kop "Daftar penerimaan gaji · Lembar N", penerima dikelompokkan per jenis dengan subtotal, kolom TANDA TERIMA ZIG-ZAG (nomor ganjil di kiri, genap di kanan, konvensi formulir kantor) berisi CAP bulat "DITERIMA tgl/bln" (klik = batalkan) / "Tandai dibayar" / "fee proyek", baris Jumlah menempel, terbilang, dan baris kosong buku besar di sisa lembar; INDEKS BULAN — 12 tab di tepi kanan lembar yang PANJANGNYA sebanding jumlah bulan itu (mulai dari nol), jadi tepi buku adalah grafik; titik amber = gaji belum dibayar; `role="tablist"` dengan panah/Home/End. Benda yang disentuh: PENGGARIS BACA yang meluncur (160 ms, tetikus atau fokus papan ketik) ke pita kosong 16px di bawah baris yang ditunjuk dan mengukur bagian orang itu dari jumlah bulan — tidak pernah lewat di belakang tulisan (jebakan #70, diaudit mekanis 6 konfigurasi). Data indeks & rak dari endpoint baru `GET /admin/payroll/ledger?year=` (`payroll.buku()`: 24 bulan + total per tahun, saringan SAMA dengan `bulan()` — dijaga tes), BUKAN dari `/costs` yang dibatasi 200 baris; kunci cache `gaji-buku-<tahun>` milik halaman ini. `Keterangan`/`pemberiKet` dipindah dari Bayaran Tim ke `kit/kartuGrafik.tsx` dan dipakai keduanya. Lebar: ≥1288 satu layar (kolom rapat 1288–1408), ≤1288 sampul jadi pita di atas lembar, ≤1100 kolom rapat + garis tanda tangan selebar kolom (isi tetap bergantian), ponsel = kartu bertingkat dengan indeks jadi pita mendatar. Tanpa migrasi. Terukur: 0 gulir dokumen/isi/lembar pada 1440x790 & 1366x768 (data contoh 5 penerima; lebih banyak orang menggulir di dalam lembar), 0 geser di 390, kontras bersih kedua tema, 47 cek alur, hidrasi bersih 8 muat, kerangka memuat setinggi papan aslinya. **Putaran "1000000x" (tampilan, bukan fitur):** sampul KULIT BERJAHIT (garis putus 5px dari tepi papan — lembar 8px, ujung tab terpanjang 8px, isi sampul 20px, jadi tidak menyentuh tulisan); tahun jilid TIMBUL bergaris (`color` tetap kas-ink supaya alat kontras dan pembaca layar membaca angkanya, isinya dikosongkan dengan `-webkit-text-fill-color`) + monogram/logo studio dari Info Studio; PITA PEMBATAS mint di lipatan sampul–lembar (12px di dalam padding kanan sampul 18px) yang selalu menandai BULAN BERJALAN — ditarik = kembali ke bulan ini, berayun ±2,5° saat disentuh tetikus (ujungnya paling jauh bergeser 9px, tulisan terdekat 14px); batang label dipecah PER PENERIMA (gaji gelap + fee mint per ruas) dan TERSOROT DUA ARAH dengan baris lembar dan cap kecil; tanda terima jadi DERET CAP KECIL berinisial (cincin rangkap mint = diterima, amber putus = belum; klik = buka barisnya); jilid yang dibuka meninggalkan RUANG KOSONG bergaris di rak ("bukunya di meja"), punggung buku berlabel tahun dan miring −4° saat disentuh; kop berperiode "1–31 Oktober" + kotak FOLIO 10/12; cap DITERIMA bercincin rangkap dengan inisial studio di busur bawah dan "tercap" sekali (380 ms) hanya saat dibubuhkan; penggaris mengukur KUMULATIF urutan lembar (ruas pucat = baris sebelumnya, pekat = orang ini; "29,8% · s.d. sini 63,7%"); Jumlah bergaris bawah GANDA (konvensi buku besar); terbilang berpagar "# … #" seperti kuitansi; tab indeks berstrip gaji/fee di dasarnya, TAKIK HANTU bulan yang sama tahun lalu di tepi atas (skala memuat kedua tahun), CENTANG untuk bulan yang semua gajinya sudah diterima, dan tertarik 4px saat disentuh. Penanda tab (titik/centang) di pojok kanan ATAS, bukan di samping label — di tab 32px keduanya berdempetan (ketahuan audit di ponsel). Semua gerak hanya tetikus dan diam bila gerak dikurangi. Terukur: 0 gulir pada 1440x790 & 1366x768, audit tumpang-tindih 0 temuan di 6 konfigurasi (pita, jahitan, takik, strip, kaki jilid, bingkai folio, penanda tab), kontras bersih kedua tema, 67 cek alur. **Putaran "1000000x" kedua (pemilik: "kenapa masih biasa aja"):** detail kecil tidak terbaca dari tangkapan layar, jadi yang diubah PANDANGAN PERTAMA dan GERAK. (1) **BALIK HALAMAN** saat pindah bulan (View Transitions, `balikHalaman`): maju = lembar lama terangkat di engsel kiri ke arah sampul, mundur = lembar baru turun dari kiri; 480 ms, perspektif 5000px (2400px membuat tepi lembar membesar keluar buku dan menutupi bilah atas — terukur dari video), sisi belakang tersembunyi; root tanpa animasi, jadi sampul/indeks/pita berganti seketika; kelas `gji-balik`/`gji-maju`/`gji-mundur` di `<html>` hanya selama satu pembalikan, seperti `lbr-temaganti` di Akun. Dipakai tab, papan ketik, pita, dan jilid; gerak dikurangi = seketika. Supaya yang terbuka berisi, lembar tiap bulan disimpan di MEMORI halaman (`simpanan`, bukan sessionStorage; dikosongkan setiap penulisan), bulan tetangga disiapkan sesudah tiap lembar dimuat, bulan lain saat kursor/fokus mendekati tabnya, dan pembalikan menunggu lembar tujuan paling lama 350 ms. (2) **KERTAS BUKU BESAR**: `--gji-kertas` (brand-soft 60% + surface), GARIS KOLOM tegak di tepi sel — tunggal di antara kolom uang, RANGKAP sebelum Jumlah dan Tanda terima, menembus kepala kelompok (kepala kelompok kini sel per kolom, bukan satu sel membentang) — pita kepala kolom mint, garis baris hijau, lengkung lipatan ke jilid (24px gradien di lajur yang cuma berisi jahitan). (3) Judul bulan 28px dengan TAHUN TIMBUL (gema sampul). (4) TUMPUKAN LEMBAR mengintip 4px & 8px di bawah lembar (papan bawah 15px; jahitan sampul di 5px). (5) KILAU FOIL menyapu tahun sampul saat disentuh. Kursor cap SENGAJA tidak dibuat: gambar kursor butuh warna literal, melanggar aturan token. Video interaksi direkam Playwright (`recordVideo`) dan frame diambil dengan ffmpeg bawaan Playwright (`/opt/pw-browsers/ffmpeg-*/ffmpeg-linux`, filter `fps` tidak ada — pakai `-ss` per frame). **Putaran "100000000x" (kebebasan penuh):** HALAMAN DEPAN jilid — lembar REKAPITULASI sebelum Januari, berkunci `YYYY-00` supaya urutan string = urutan buku dan arah balik halaman benar tanpa kasus khusus (`?bulan=2026-00` membukanya). Isinya 12 baris buku besar 30px: nama bulan = tombol yang membalik ke lembarnya, kolom batang gaji/fee (satu-satunya kolom tanpa tulisan) dengan takik bulan yang sama tahun lalu dan garis putus rata-rata per bulan yang menyambung antarbaris, Gaji/Fee/Jumlah penuh, status (cap LUNAS / "N gaji belum" amber / fee saja / kosong / belum tiba), kaki Jumlah jilid bergaris ganda + legenda, terbilang. Semua dari `buku` (tanpa permintaan baru); rata-rata dibagi bulan berjalan, skala batang = skala tab indeks (kedua tahun). Dibuka dari tab "Rekap" bermint di puncak indeks (13 tab), dari RUANG KOSONG jilid di rak (punggung buku yang sedang dibuka), atau ← dari Januari. Di halaman depan SAMPUL ikut: label = jumlah jilid + tren dari tahun lalu + batang per BULAN, tanda terima = 12 cap bulan (mint lunas / amber belum / putus kosong) yang bisa diklik; menyentuh baris, ruas, atau cap menyorot bulan yang sama di ketiganya. Kolom status halaman depan 112px (bukan 176) supaya batang ±170px. CAP LUNAS (segel persegi bercincin rangkap) juga di baris Jumlah lembar bulan yang semua gajinya diterima, dengan tanggal bayar terakhir. MEMBALIK DENGAN PAPAN KETIK di mana saja: ←/PageUp, →/PageDown — tidak menyala di isian, dialog, menu, listbox, slider, atau bersama tombol pengubah. Ponsel: halaman depan kartu bertingkat (bulan + jumlah, batang, status); garis kolom buku besar dimatikan di kartu (aturan `.gji__daftar .gji__k-*` berkekhususan 0,2,0 mengalahkan `tfoot td` 0,1,2 — dipaksa `!important`). Terukur: 0 gulir pada 1440x790 & 1366x768 di ketiga jenis lembar, audit tumpang-tindih 0 di 10 konfigurasi (termasuk takik & garis rata-rata), kontras bersih, 86 cek alur |
| **Keluar MENCABUT sesi di Supabase; ganti sandi mengeluarkan perangkat lain** | Ketahuan dari produksi (dibaca saja): akun master punya 88 sesi hidup sejak 25 Agustus, 87 refresh token tidak pernah dicabut, karena Keluar cuma menghapus token di peramban. Sekarang `keluar()` memanggil `POST /admin/account/logout {scope:"local"}` (usaha-terbaik, 2,5 detik), tombol "Keluarkan perangkat lain" memakai `scope:"others"`, dan ganti sandi memanggil `others` di server. Token akses yang sudah terbit tetap sah sampai kedaluwarsa (≈1 jam) karena API memverifikasinya lewat JWKS — kalimat di halaman menyebut "paling lambat satu jam". Login kini meneruskan User-Agent peramban ke GoTrue; sebelumnya semua sesi tercatat "quic-go HTTP/3"/kosong, jadi sesi lama dirangkum sebagai "N sesi tanpa nama perangkat". Ganti sandi memverifikasi sandi lama dengan grant `password` lalu langsung mencabut sesi cek itu, dan dibatasi KV 10/jam. Galat GoTrue (`same_password`, `weak_password`, `reauthentication_needed`) diterjemahkan — dulu semuanya "gagal mengubah kata sandi". Batas di API dinaikkan dari 8 ke aturan Supabase (12 + empat jenis) |
| **Info Studio `masterOnly` di peta navigasi** | Halamannya sudah lama `RequireAuth masterOnly`, tapi rel tetap menawarkannya ke staf — yang lalu melihat "Tidak bisa memuat panel". Konsekuensi: baris itu baru muncul sesudah peran dibaca, jadi penggulir rel ke baris aktif kini juga menunggu `master` (tanpanya baris Akun terdorong ke bawah kartu akun) |
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
| **Harga DIUMUMKAN di beranda** — membalik sikap sebelumnya | Enam tier dari §3.1 dan §3.2 lengkap dengan rentang fee, di `lib/tier.ts`. Ini membalik jawaban FAQ lama yang berbunyi "angka sebenarnya belum diumumkan di halaman ini", dan **jawaban itu sudah ikut diubah** — dua tempat yang menyebut harga harus selalu sepakat, kalau tidak yang membaca berhenti percaya keduanya. Yang TETAP tidak diumumkan dan tetap bertanda "ditanyakan": persentase uang muka, lama tiap tahap, dan jadwal kunjungan lokasi; ketiganya memang berubah per proyek dan dokumen strategi tidak menetapkannya. Kalau harga naik (aturannya di §3.3: tiap 3 proyek selesai pada satu tier, naik 10–15% untuk klien baru), pemilik mengubahnya sendiri di `/admin/paket` — lihat baris di bawah |
| **`.btn--dot` = kotak GELAP bergaris teal, bukan tombol teal pejal** | Membalik bentuk sebelumnya (latar teal, titik gelap), yang ditolak pemilik dengan acuan tombol "Sign up for free" refine.dev: latar gelap, garis teal, teks teal, tekstur titik teal. Bentuk yang sama dipakai tiga tempat supaya satu bahasa visual untuk "ini aksi utama / ini tujuannya": tombol nav, lencana pembuka hero (`.hero-lencana`), dan tab tarif yang sedang aktif. Kalau salah satunya diubah, ketiganya harus ikut. Tombol navbar tetap RECTANGLE, bukan pil |
| Judul tab dan meta description ikut bahasa; kartu bagikan TIDAK | Dilaporkan pemilik sebagai bug SEO: isi halaman sudah Indonesia, judul tab masih Inggris. Diperbaiki lewat dua kunci khusus `metaJudul` dan `metaKet` di tiap kamus halaman, dibaca pengalih bahasa — bukan `data-t`, karena keduanya tinggal di `<head>`. Yang **tidak bisa** diperbaiki dengan cara ini: kartu bagikan WhatsApp/Twitter membaca HTML yang DISAJIKAN server, bukan hasil skrip, jadi kartunya selalu versi Inggris. Menukarnya butuh rute `/id` terpisah — yang sudah ditolak karena dua berkas berisi kalimat yang sama pasti menyimpang |
| **Positioning NASIONAL, bukan Pontianak saja** | Permintaan eksplisit pemilik: "jangan buat ini patokan di pontianak aja tapi ini untuk 1 indonesia". Ini BERBEDA dari dokumen strategi, yang seluruhnya menganalisis pasar Pontianak — jadi kalau suatu saat ada yang membandingkan situs dengan PDF-nya, perbedaannya memang sengaja dan pemilik yang memutuskan. Pontianak tetap disebut sebagai tempat studio berkantor (dan itu yang menjelaskan keahlian iklim lembapnya), bukan sebagai batas layanan. Yang ikut berubah: eyebrow hero, kalimat material, meta description tiap halaman, dan satu catatan di kaki seksi tarif tentang biaya perjalanan |
| **Portal klien terbuka dalam bahasa INDONESIA**, bukan Inggris | Membalik bawaan sebelumnya. `/progres` dan `/bukti` TETAP dwibahasa — pengalih EN/ID-nya tidak dibuang, dan alasannya masih berlaku: klien asing mungkin membukanya. Yang berubah cuma halaman mana yang muncul lebih dulu. Positioning situs sudah nasional Indonesia, jadi hampir setiap klien yang membuka tautan WhatsApp dari studio adalah klien Indonesia — dan sebelumnya mereka mendarat di halaman berbahasa Inggris lalu harus menemukan sendiri pengalih di pojok kanan atas. Sekalian diperbaiki: pemulihan pilihan bahasa dari localStorage dulu hanya memeriksa `"id"`, jadi klien yang sengaja memilih Inggris dikembalikan ke Indonesia tiap kali halaman dimuat ulang |
| Pemutar pesan suara memakai kulit sendiri di atas `<audio>` SUNGGUHAN | Catatan lama di `progres/index.astro` memilih `<audio controls>` bawaan supaya perilakunya tidak bisa rusak diam-diam. Alasan itu masih benar dan tetap dijaga — elemen `<audio>`-nya masih ada, cuma disembunyikan, dan pendekodean, pencarian posisi, serta penanganan jaringan tetap milik peramban. Yang diganti kulitnya: `controls` bawaan menggambar widget abu Chrome selebar kartu yang bentuknya berbeda di tiap peramban, dan di halaman yang dilihat klien itu hal pertama yang terlihat salah. Kelas `.suara__p`/`.suara__bar`/`.suara__w` sudah ada di stylesheet sejak mockup pertama dan tidak pernah dipakai |
| Dokumen di portal klien menampilkan PRATINJAU isinya, bukan ikon generik | Studio arsitektur mengirim gambar; kotak ikon 38px yang sama untuk denah, tampak, dan potongan membuat empat dokumen berbeda terlihat identik sampai judulnya dibaca satu per satu. Berkas gambar menampilkan isinya, yang bukan mencetak jenisnya besar-besar. Yang menunggu tanggapan diberi garis kiri amber — terbaca sebelum satu pun kata dibaca |
| Pindah urutan menukar `sort_order` dua tetangga, bukan menulis ulang daftar | Dua permintaan alih-alih delapan, dan urutan yang lain tidak ikut berubah kalau salah satunya gagal |
| **Paket layanan pindah ke database (`service_tiers`), diurus dari `/admin/paket`** | Dipilih pemilik saat frame 31/34 dibangun: harga yang naik tiap tiga proyek tidak boleh menunggu saya mengubah kode. Isi awal migrasi `20260929000025` = enam paket yang tayang, dan beranda terbukti identik byte-per-byte setelah sumbernya pindah. Kelompoknya (tab + kalimat pengantar) sengaja TETAP di `lib/tier.ts` — itu positioning, bukan isian. Jawaban FAQ "Berapa tarif Anda?" sekarang disusun dari data yang sama (`kalimatTarif`), jadi dua tempat yang menyebut harga tidak bisa menyimpang. Isi paket disimpan sebagai TEKS satu butir per baris, bukan array — jebakan #16. `listTiers()` memakai `wajib()`: beranda tanpa harga tidak boleh tayang diam-diam |
| **Tulisan jurnal punya SAMPUL, diunggah dari panel ke R2 `jurnal/`** | Dipilih pemilik saat frame 37/40 dibangun. Kolom `cover_key` NULLABLE dengan CHECK `^jurnal/…` (migrasi `20260929000026`) — folder terpisah dari `projects/` dengan alasan yang sama seperti `studio/` dan `klien/`. Tanpa sampul, kartunya memakai bidang warna kategori; tulisan lama tidak perlu diisi satu per satu. Di `/jurnal/<slug>` sampulnya tampil di atas artikel dan jadi gambar kartu bagikan, jadi rasionya 1200/630 — di panel juga, supaya potongan yang dilihat staf sama dengan yang dilihat pembaca (frame 40 menggambarnya 1136x592, selisih 4px) |
| **Editor jurnal = halaman BACA frame 40 yang bisa disunting di tempat** | Judul, pembuka, dan isi adalah kotak tanpa garis yang baru bergaris saat disentuh, sehingga teksnya jatuh persis di posisi teks framenya (x321, 16/25). Isi TETAP markdown mentah, tanpa perender kedua — keputusan lama tidak berubah; yang diturunkan ke kolom kanan cuma daftar baris `## ` sebagai daftar isi. Tombol Simpan yang mati selalu menyebut alasannya (syarat yang sama dengan `checkJournalInput`) |
| **Tombol Terbitkan juga ada di kepala halaman kit, dengan SATU logika** | *(Tombol bola dunianya kini STEMPEL REV — lihat "Navbar = KEPALA LEMBAR"; logikanya tetap `useTerbit`.)* Halaman yang pindah ke KitLayout kehilangan bilah atas lama beserta tombolnya, padahal toast Jurnal dan Paket menyuruh menekannya. Keadaannya (polling `cap-build.json`, status, "belum tayang") dipindah ke `components/admin/useTerbit.ts` dan dipakai `Topbar` maupun `TerbitKit`; yang dua cuma tampilannya. Ikonnya bola dunia karena pustaka ikon Coinest tidak punya panah unggah — menggambarnya sendiri berarti menjiplak. Konsekuensinya, `KepalaKit` sekarang SELALU dihidrasi, dan `TombolBulat` meneruskan ref supaya bisa jadi pemicu Radix |
| **Gaji dibangun dari frame 25 LAGI, bukan halaman sendiri tanpa frame** | Dipilih pemilik: Gaji tidak punya frame, dan di pemetaan ia berbagi frame 25 dengan Fee. Kerangkanya sama persis dengan Fee Proyek — terbukti: kotak kelima widget identik — dan helpernya (nominal, pemilih, sumbu) hidup di `components/admin/frame25.tsx` yang dipakai keduanya, bukan disalin; Fee terbukti identik piksel demi piksel setelah helpernya dipindah. Aturan "fee menulis, gaji membaca" tidak berubah: kolom Fee di tabel tidak bisa diketik. Mengubah dan menghapus lewat NAMA orang di tabel, karena tabel kit tidak punya kolom aksi. Grafik Total Gaji diberi ruang kepala 80% seperti framenya — gaji hampir rata, dan tanpa itu garisnya menimpa tooltip puncak |
| **Halaman kit di ponsel: menu geser SEMENTARA, sampai frame Mobile diekspor** | Dipilih pemilik. Sebelumnya rel samping tetap 192px di layar 390, isi tinggal ~160px, dan halaman bisa digeser 134px ke samping — di ketiga belas halaman kit yang sudah tayang, padahal pemilik memang membuka panel dari ponsel. Di bawah 40rem (sejak rel 240: 56rem, jebakan #41) rel jadi menu geser (bentuknya menu geser panel lama yang sudah di-ACC, BUKAN dikarang dari frame); keadaannya milik `RelKit`, tombolnya di `KepalaKit`, keduanya bicara lewat peristiwa `kit:rel`. Tabel lebar tetap digulir di dalam kartunya sendiri. Terbukti tidak menyentuh desktop: ke-14 halaman identik piksel demi piksel dengan versi yang tayang pada 1440, 1024, dan 768 — kecuali judul Detail Tulisan pada 768 yang kini terlipat alih-alih terpotong. Begitu frame Mobile Coinest diekspor, tampilannya disamakan dengan frame itu |
| **Dashboard (frame 01) di kerangka kit — halaman keempat belas, yang terakhir** | *(DIGANTIKAN Ruang Kendali Studio, Okt 2026 — riwayat saja, jangan dibangun ulang.)*  Tata letak 100% frame, isinya milik studio (pemetaan slotnya di kepala `DashboardKit.tsx`). Judulnya **"Dashboard"**, bukan "Hari Ini" milik kerangka lama: rel samping sudah lama menyebutnya begitu, dan satu halaman dengan dua nama membuat orang ragu. Slot "Recent Transactions" berisi **laba per proyek**, bukan transaksi — "Transaksi Terbaru" sudah ada di Keuangan. Status "Rugi" hanya untuk proyek yang SUDAH lunas: laba dihitung dari kas yang masuk, jadi proyek yang baru DP selalu tampak minus. Kartu keterangan grafik **tidak menyala sejak awal** seperti di framenya (Juni, di tengah): bulan yang wajar dinyalakan adalah bulan ini, yang selalu di ujung kanan, dan di sana ia menutupi legenda. Butir "Perlu Ditangani" dibatasi RUANG kartu (diukur sekali per perubahan data/ukuran), bukan angka tetap. Tablet: kolom tengah naik selebar penuh supaya tabelnya tidak digulir mendatar. `DashboardHome` lama dan ~570 baris CSS `.dash*` dibuang |
| **Keuangan jadi satu pintu; halaman "Kerja Internal" dibuang** | Pemilik melaporkannya sebagai "sangat membingungkan". Sebabnya bukan tata letak: halaman itu tidak punya isi sendiri — ia potongan dua halaman lintas-proyek yang disaring ke satu proyek, jadi tugas, biaya, dan pipeline masing-masing punya DUA pintu masuk. Sekarang pengeluaran dicatat dari satu tempat dengan dropdown proyek di dalam dialognya |
| **Fee menulis, Gaji membaca** | Pemilik memilih fee per proyek ke orang DAN halaman gaji yang memuat freelancer — dua jawaban yang kalau diikuti mentah membuat satu bayaran freelancer bisa diketik dua kali, dan beban studio tercatat ganda. Ditutup di lapisan data, bukan di UI: tabel `payroll` secara struktur TIDAK BISA memuat bayaran proyek, dan baris freelancer di halaman Gaji diturunkan SQL dari `project_costs`. Jadi angka ganda bukan cuma tidak dianjurkan — ia tidak bisa terjadi |
| Biaya proyek menyimpan SIAPA yang dibayar, dan boleh kosong | Tanpa kolom itu pertanyaan "orang ini tahun ini terima berapa dari semua proyek" tidak pernah bisa dijawab. Boleh kosong dua kali disengaja: biaya operasional memang bukan milik siapa pun, dan puluhan baris lama tidak punya nama — menautkannya satu per satu memakan waktu pemilik untuk angka yang sudah lewat. `on delete set null`, bukan cascade: menghapus freelancer tidak boleh menghapus biaya yang sudah keluar |
| **Tabel daftar baru memakai bentuk Halaman Proyek, bukan Semua Proyek** | Koreksi eksplisit pemilik. `DataTable` punya prop `bentuk`: `listbar` (bilah full-bleed bergaris tebal, berkolom nomor — enam daftar lama) dan `kartu` (kartu hitam bingkai 2px, kotak cari pil selebar penuh, tabel berkartu, tanpa kolom nomor). Aturan CSS-nya TIDAK disalin: tiap aturan `.pilihproyek__*` memuat pasangan `.kartudaftar__*`-nya di selektor yang sama — satu blok, dua nama. Tombol aksi utama duduk DI DALAM bilah tabelnya, seperti "Proyek Baru" |
| **Keuangan, Fee Proyek, dan Gaji jadi SATU menu di sidebar** | Permintaan pemilik: "buat sub agar user tidak bingung, contoh keuangan isinya apa aja". Alasan ketiganya berdampingan tidak berubah — angka fee lahir di Keuangan, Gaji menjawab pertanyaan yang sama dari sisi bulan — tapi tiga baris setara terbaca sebagai tiga pembukuan yang harus dicocokkan. Pesan Masuk sengaja TIDAK ikut dikelompokkan ke mana pun: isinya calon klien, dan satu klik tambahan untuk menemukannya adalah satu klik yang kadang tidak terjadi |
| Kepala kelompok sidebar bisa ditutup, bawaannya TERBUKA | Dua puluh baris menu = 1.155px di dalam slot 744px, jadi "Situs Publik" dan "Sistem" berada di bawah lipatan tanpa tanda apa pun. Kelompoknya tetap terbuka sebagai bawaan supaya daftar Situs Publik tetap jadi pengingat apa yang belum diisi — alasan aslinya masih berlaku; yang ditambahkan cuma kemampuan menutupnya, dan pilihannya disimpan di localStorage. Di rel sempit semua kelompok dipaksa tampil: kepala kelompoknya ikut disembunyikan di sana, jadi kelompok tertutup tidak punya tombol untuk dibuka lagi |
| **Nama studio dibuang dari tombol akun di bilah atas** | Sidebar sudah menuliskannya utuh dan permanen 270px di sebelah kiri, dan salinan keduanya terpotong jadi "Dirga Pahlevi Archit…" di setiap lebar sejak bilahnya dibuat (butuh 194px, batasnya 160px). Melebarkan batasnya memuat namanya, tapi ruangnya diambil dari combobox proyek yang lalu terpotong jadi "Semua Proye" — dan yang itu fungsional. Yang tersisa di tombol itu peran akun, satu-satunya keterangan di sana yang tidak ada di tempat lain, dan dengan dua akun penulis ia yang paling perlu dibaca sekilas |
| **Garis miring topbar jalan sampai ujung kanan** | Membalik keputusan pemilik sebelumnya ("berhenti setelah penghitung proyek"). Terukur: tanda bacanya berhenti di 747px dari bilah 1168px, jadi 693px sisanya berdiri tanpa pemisah dan terbaca sebagai barang tercecer. Lonceng dan panel akun tetap tanpa garis miring karena garis tegak 2px milik lonceng sudah memisahkan keduanya |
| **Portal Klien pindah ke kit; `ProjectEditor.tsx` dan `FinancePanel.tsx` DIBUANG** | Halaman terakhir kelompok Proyek. Kerangka frame 34 yang sama dengan Halaman Publik; pemilih proyeknya satu modul bersama (`components/admin/pilihProyekKit.tsx`), bukan salinan. `FinancePanel` ternyata sudah tidak diimpor halaman mana pun sejak Keuangan pindah ke kit — `PanelKeuangan` cuma hidup untuknya, jadi editor lama bisa dibuang utuh. Dua cacat produksi ketahuan di jalan: (1) panel Brief lama MENAMPILKAN anggaran dan kedua tanggal tapi tidak pernah MENGIRIMNYA — "Brief disimpan", lalu angkanya hilang saat dimuat ulang; (2) `/progres` membandingkan penulis komentar dengan `"studio"`, padahal enum database `staf`/`klien` — jadi di layar klien balasan studio tertulis "Anda". Logika `VoiceNote` dipecah jadi `usePemutarSuara`/`useRekamSuara`, dan kulit kitnya (`kit/Suara.tsx`) terdaftar di `/admin/kit`. CSS editor lama (`.proyekpage`, `.pilihproyek__*`) SENGAJA belum dibuang: tiap aturannya berpasangan dengan `.kartudaftar__*` yang masih dipakai enam halaman lama, dan keduanya pergi bersama begitu halaman itu pindah |
| **Kelompok Tugas & daftar pindah ke kit, di atas SATU kerangka daftar (`daftarKit.tsx`)** | Tugas, Direktori, Testimoni, dan Tim memakai kerangka frame 13 yang diangkat dari Semua Transaksi — bilah cari + `PilihTombol`, tabel kit, kaki paginasi — dengan stylesheet tunggal `daftar-kit.css`. Semua Transaksi sendiri dipindah ke kerangka itu dan terbukti identik piksel demi piksel (1440/1024/390, terang dan gelap), begitu juga Portal Klien setelah status-pemilihnya jadi `PilihStatus` bersama. Menyaring tetap urusan tiap halaman; kerangka cuma memotong halaman, dan kembali ke halaman 1 saat saringan berubah dibandingkan saat RENDER (bukan efek). Notifikasi memakai linimasa yang sama dengan "Perlu Ditangani" di Dashboard lewat `linimasaNotif.tsx`. Tiga cacat produksi ketahuan di `lib/notifikasi.ts` dan sudah diperbaiki: tugas disaring `!== "done"` padahal enumnya `selesai` (tugas yang sudah selesai dilaporkan terlewat selamanya), testimoni `=== "pending"` padahal enumnya `menunggu` (testimoni yang menunggu tidak pernah muncul di lonceng), dan jenis proyek tercetak mentah ("commercial"). `TaskBoard`, `DirectoryPanel`, `TestimonialsPanel`, `TeamPanel` dibuang; `NotifikasiPanel` tinggal dua bagian yang masih dipakai lonceng kerangka lama |
| **Situs Publik & Pengaturan pindah ke kit, di atas SATU kerangka (`situsKit.tsx`)** | Kelompok terakhir halaman kerangka lama: Logo Klien, Tim Studio, Sebelum & Sesudah, Angka di FAQ, Halaman Privasi, Identitas Studio, Info Studio, Akun. Kerangka frame 34 yang sama dengan Halaman Publik — kolom utama berisi PRATINJAU gelap persis seperti di situs, lalu isiannya; kolom samping menjawab "sudah lengkap belum, dan di mana saya melihatnya". `HalamanSitus` menggantikan `SisiSitus`, `IsiHalamanKit` menggantikan `IsiHalamanPanel` dengan antarmuka `Isian` yang sama, jadi tiga halaman teks (FAQ, Privasi, Identitas) tetap satu komponen. Logika lama dibawa apa adanya (ambang `lib/logoBentuk`, tukar `sort_order` tetangga, kunci R2 baru disimpan sesudah unggah berhasil, isian kosong dikirim sebagai null, hanya kolom yang berubah yang dikirim). Tiga perbaikan: tahun di Identitas wajib empat angka (dulu "21" lolos dan tercetak di garis waktu); halaman Akun memeriksa aturan kata sandi SUPABASE — 12 karakter, besar, kecil, angka, simbol — padahal halaman lama menyebut "minimal 8" sehingga sandi 8–11 karakter ditolak server tanpa alasan yang terbaca; dan label loncatan pembanding dibetulkan (0% = sesudah penuh). Tujuh panel lama dibuang: `SisiSitus`, `IsiHalamanPanel`, `ClientLogosPanel`, `TimStudioPanel`, `BandingPanel`, `SettingsForm`, `AccountPanel`. Kerangka lama (`AdminLayout`/`Topbar`) sekarang cuma dipakai `/admin/ui`, `/admin/kit`, dan `/admin/masuk` |
| **Fitur yang hilang saat rombak ke kit dipulihkan DI DALAM kit, bukan dengan menghidupkan komponen lama** | Delapan fitur (jebakan #38) kembali memakai bagian kit: Keluar jadi baris terakhir rel (ikon Nav-SignOut milik Coinest, di slot kaki yang di framenya berisi banner promo) dan relnya kini bergulir sendiri — dengan Situs Publik terbuka baris terakhir berakhir di y936, di bawah tepi layar 800; kotak "Cari di panel" membuka palet `Perintah` yang sama; lonceng dan tombol pesan memakai titik `TombolBulat` dengan angka dari `lib/notifikasi` (sumber yang sama dengan Notifikasi dan Dashboard) dan mengabarkan angka pesan ke rel lewat `kit:pesan`; bukti pembayaran jadi `buktiKit.tsx` (muncul sendiri sesudah Terima Pembayaran mencatat, dibuka ulang dari baris Pembayaran Terbaru dan dari nama pembayaran di Semua Transaksi); PDF jadi `lib/pdfProyek.ts` dengan menu di kepala Satu Proyek, datanya diambil SEGAR saat ditekan. Isi keduanya dibawa apa adanya dari versi lama. Kolom isi ke-30 halaman kit terbukti identik piksel demi piksel dengan build produksi (1440 terang/gelap, 390), kecuali ikon PDF di Satu Proyek. `PaymentFlow.tsx`, `LoginForm.tsx`, dan `lib/pakaiData.ts` — tanpa pengimpor — dibuang |
| **Kepala kelompok rel (Proyek, Keuangan, Situs Publik, Pengaturan) jadi TOMBOL buka-tutup** | Dilaporkan pemilik: "klik panah bawah ga muncul". Sebabnya: baris induknya `<a href="#">` tanpa penangan, dan submenunya cuma terbuka kalau salah satu anaknya sedang dibuka — jadi caret-nya hiasan sejak rel kit dibuat, dan audit kontrol mati menemukan empat baris mati di tiap halaman. Sekarang `<button aria-expanded aria-controls>`; kelompok halaman yang sedang dibuka terbuka sendiri, sisanya menurut klik, dan keadaannya bertahan antarhalaman karena rel ber-`transition:persist` |
| **Rel samping 240, BUKAN 192 milik frame Coinest** — bentrok dengan frame, disebutkan terbuka ke pemilik | Rel 192 dirancang untuk label Inggris yang pendek. Terukur 17 dari 32 label menu terpotong ("Terima Pem…", "Pengatu…", "Tim & Freela…"); "Terima Pembayaran" butuh 127px sementara barisnya menyisakan 84, jadi tidak ada padding yang bisa menutupnya. Ongkosnya kolom konten 48px lebih sempit — ditutup di titik-patah dan tabel (jebakan #41), sehingga pada 1440 tidak ada tabel yang perlu digeser dan tinggi tiap tabel sama persis dengan produksi. Tablet tegak (≤896) kini memakai menu geser: dengan rel 240, layar 768 cuma menyisakan 488px konten. Galeri kit tetap 192 untuk membandingkan komponennya dengan frame. Kalau pemilik memilih kembali ke 192, cukup `--kl-rel` dan geser balik titik-patahnya |
| **Termin baru dan hapus termin di Tagihan & Termin; rincian dan hapus biaya dari Catat Pengeluaran & Semua Transaksi** | Sisa dari audit fungsi API tanpa pemanggil (jebakan #38): `tambahInvoice`, `hapusInvoice`, `hapusBiaya` tidak bisa dijangkau dari kerangka kit. "Tagihan Baru" dulu cuma mengalihkan ke halaman lain; sekarang dialognya sendiri, dengan konteks kontrak (sudah ditagihkan, sisa), nama bawaan "Termin N", urutan = urutan terakhir + 1, dan peringatan kalau nominal melewati sisa kontrak — peringatan, bukan penolakan, karena adendum memang terjadi. Termin baru selalu Draf. Hapus massal menyebut kalau ada termin LUNAS di antaranya. Tombol dan menu ⋯ yang cuma hiasan di Terima/Keluar sekarang menuju halaman yang masuk akal, dan "Lihat semua" mendarat di Semua Transaksi yang sudah tersaring per jenis |
| **Permintaan GET yang sama dan sedang berjalan DIGABUNG di `panggil`** | Kepala halaman (angka lonceng), rel, dan isi halaman meminta data yang sama saat halaman dibuka. Digabung di satu tempat — bukan dengan menyuruh tiap komponen saling menunggu — dan tiap pemanggil menerima SALINANNYA sendiri (`structuredClone`), supaya satu komponen yang mengubah hasilnya tidak mengubah milik yang lain. Terukur: muat penuh `/admin` 17 → 11 permintaan, pindah ke Pesan Masuk 10 → 6. Hanya yang sedang berjalan; hasil yang sudah selesai tidak disimpan di sini (itu tugas `bacaCache`) |
| **Tautan "lihat di situs" disembunyikan sampai halamannya benar-benar dibangun** | Halaman Publik, Satu Proyek, dan Detail Tulisan membandingkan waktu terbit/ubah dengan stempel build (`CAP_BUILD`, dioper dari `.astro` — dievaluasi di peramban ia jadi "sekarang"). Proyek atau tulisan yang belum ikut build menampilkan "Belum ada di situs — tekan Terbitkan" alih-alih tautan yang berakhir 404. Gagal-terbuka: kalau salah satu stempel tidak ada, tautannya tetap tampil |
| **Tombol Pesan dan lonceng membuka PANEL PRATINJAU, bukan pindah halaman** | *(Bentuk panelnya kini DAFTAR REVISI dan SURAT PENGANTAR — lihat baris "Isi Ctrl K, Notifikasi, dan Pesan"; keputusan "pratinjau, bukan pindah halaman" tetap.)* Dari kebebasan yang diberikan pemilik ("saat saya klik pesan di nav tampilannya harus kyk gimana"). Pindah halaman hanya untuk menjawab "ada apa?" adalah satu muat halaman yang sia-sia. Panel Pesan: lima teratas, yang belum dibaca lebih dulu (avatar pejal + titik merah), nama/waktu relatif/jenis·anggaran/cuplikan; klik membuka pesan itu langsung (`/admin/pesan?id=`). Panel lonceng: dikelompokkan per hari seperti linimasa Dashboard, isinya sumber yang sama dengan angkanya. Keduanya punya keadaan memuat, kosong, dan galat sendiri, dan tautan "Buka semua" di kaki. Pesan diambil saat panel DIBUKA, bukan tiap muat halaman (`components/admin/panelKabar.tsx`) |
| **Baris rel yang aktif BERGARIS — membalik "pil mint saja"** | *(Garis TEPI per baris kini digantikan PENANDA POTONGAN yang meluncur — lihat "Sidebar = SET GAMBAR KERJA luar-dalam"; permintaan "ada garis saat dipilih" tetap terpenuhi, garis pohon tetap ada.)* Permintaan pemilik: "pastikan sidebar ada garis saat dipilih". Dua garis, masing-masing satu tugas: garis TEPI 4px di sisi kiri rel sejajar baris yang dibuka (menu atas maupun submenu), dan garis POHON 1px yang menyusuri submenu di poros ikon induknya (x28) dengan ruas 3px di submenu aktif — garis `Line` frame Coinest yang dulu dibuang karena dikira "efek" (yang sebenarnya pudar silang router, jebakan #45). Tanpa transisi. Submenu sekalian dimulai di 44px dan 13px: lima label Indonesia butuh 133–158px di slot 132 dan terpotong; slotnya kini 148 |
| **"UI Component" di rel membuka galeri KIT di kerangka kit** | Dulu membuka `/admin/ui` — sistem lama di kerangka lama, huruf dan rel yang sama sekali lain, terbaca sebagai panel yang rusak. `/admin/kit` kini di KitLayout; `/admin/ui` masih bisa dibuka lewat alamatnya |
| **Latar panel kit ABU tipis (`--k-latar` #F1F3F2 / gelap #171D1C), bukan putih** | Permintaan pemilik: "latar diberi abu tipis agar lebih terlihat hidup". Kartu tetap putih, jadi kartunya kini terbaca sebagai benda di atas meja tanpa satu bayangan pun. Ongkosnya ditanggung di dua tempat: kontrol yang duduk langsung di latar diberi bidang (jebakan #53), dan teks di luar kartu diturunkan ke `--text-muted` supaya lolos kontras |
| **Pindah menu dihangatkan saat kursor MENDEKATI tautan (`lib/hangat.ts`)** | Prefetch bawaan Astro cuma mengambil HTML; CSS dan modul island halaman tujuan baru diminta sesudah klik, satu RTT per lapis. `hangat.ts` mengambil ketiganya saat hover (jeda 60 ms, cuma tetikus) dan menyuapkan HTML-nya ke `astro:before-preparation`. Terukur dengan RTT 120 ms, kunjungan pertama: 514–778 → 180–364 ms. Ikon dipecah satu berkas per ikon (Rollup tidak pernah memecah satu modul), jadi JS per halaman 739 → ~660–690 KB. Angka lonceng dan status Terbitkan disimpan di modul selama 20 detik, dihapus tiap penulisan, supaya kepala halaman tidak mengambil ulang tiap pindah menu |
| **Pustaka 62 komponen kit + halaman UI Component berbentuk FOLDER** | Permintaan pemilik: dirapikan per kategori, klik folder → daftar, klik komponen → demo hidup. Tiap tingkat punya alamat hash (`#overlay/alert-dialog`) supaya tombol Kembali dan tautan berbagi bekerja. Komponen kit yang setara dengan komponen lama (dialog, menu, toast) MENGGANTIKAN pemakaian lama di seluruh halaman kit, bukan hidup berdampingan — dua komponen untuk satu tugas pasti menyimpang (jebakan #32) |
| **Ubin ikon kartu angka MINT, dan kartu statistik Dashboard bergaris tren** | Permintaan pemilik: "warna menyala, web hidup". Ubin pucat `--brand-soft` di atas kartu putih nyaris tak terbaca sebagai benda, sementara ubin ikon di daftar dan linimasa sudah mint — sekarang satu bahasa: ikon di ubin = mint, tinta hijau tua di kedua tema. Kartu statistik Dashboard memuat `Kilau` (grafik garis mungil enam bulan, dari data arus kas yang sudah dimuat — tanpa permintaan baru); warnanya token brand/bahaya, bukan biru #1F3045 milik frame yang tidak punya nilai tema gelap. Tanpa animasi masuk: "one klik pindah one klik berubah, jangan ada yang melekat" |
| **Panel kit MUAT SATU LAYAR di laptop; halaman tidak bisa digeser** | Dipilih pemilik ("Muat satu layar"): rel dan navbar diam, `.kl` setinggi layar dan `overflow: hidden`, isi halaman mengisi sisa tingginya, dan yang memanjang menggulir di dalam KARTUNYA sendiri (daftar, tabel, lembar tulisan, galeri). Kerangkanya berlaku dari 56.01rem dan tinggi ≥600px; penyesuaian tiap halaman (grafik lebih pendek, kartu statistik dipadatkan) hanya dari 1288px, karena di bawahnya kolom-kolomnya memang ditumpuk dan area isi menggulir sebagai jaring pengaman. Terukur 32 halaman pada 1440x790 dan 1366x768: dokumen, area isi, dan rel 0px. Ponsel tetap boleh digulir. Yang SENGAJA digulir karena isinya memang lebih panjang dari layar mana pun: lembar Detail Tulisan (kolom kanannya diam), kartu rincian Satu Proyek, dua seksi bawah Jurnal, dan isi galeri UI Component. Kalau menambah halaman kit: ukur dengan `kl__isi.scrollHeight − clientHeight` dan `scrollingElement.scrollHeight − innerHeight`, keduanya harus 0 |
| **Rel BERKATEGORI (Utama, Pekerjaan, Relasi, Konten Situs, Pengaturan) — membalik "Coinest tidak punya kepala kelompok"** | Permintaan pemilik: "sidebar dibuat berdasarkan kategori … harusnya ada batas". Bentrok dengan frame Coinest, yang tidak punya kepala kelompok — disebutkan terbuka ke pemilik. Kategorinya `group` di `lib/navAdmin.ts` (satu daftar untuk rel DAN palet, jebakan #32); submenu "Pengaturan" lama diratakan jadi kategori. Batasnya garis 1px `--k-garis-pohon` di atas tiap kepala kecuali yang pertama. Kaki rel jadi kartu akun (nama dari bagian lokal email, peran, tombol Keluar). Yang bergulir cuma daftar menunya — kepala dan kartu akun diam — dan itu pun hanya saat submenu besar terbuka (Keuangan, Situs Publik) |
| **Kerangka kit = latar MINT + panel isi melengkung (frame 01), kepala halaman DI DALAM panel** — membalik "navbar bilah putih menyambung dengan kepala rel" | Pemilik: "navbar jangan menyatu dengan sidebar, dibuat melengkung", lalu mengirim SVG frame 01 sebagai acuan sesudah dua tafsiran saya ditolak (kartu navbar hijau melayang: "malah makin jelek"). Bentuk yang dimaksud adalah frame itu sendiri: `<body>` `--brand-soft` (sama dengan rel), `.kl__utama` panel `--k-panel` (#FBFBFC, gelap #171D1C) bersudut 24 di kiri — path `M192 24C192 10.7…` di SVG-nya — dan kepala halaman satu baris 38 tinggi di y22 tanpa garis bawah, badan mulai y80. Tanggal di bawah judul dibuang. Kepala rel 82 tanpa garis, logonya sejajar tengah judul. Ini juga mengganti latar abu tipis (`--k-latar`) sebagai bidang halaman: abu di atas mint nyaris tak berbeda (#F1F3F2 lawan #ECF4E9), jadi panelnya #FBFBFC seperti frame — kartu putih bergaris tetap terbaca. Di ponsel panelnya tanpa lengkung |
| **Dashboard memakai UKURAN FRAME 01, dan karena itu MENGGULIR di layar laptop** — bentrok dengan "muat satu layar", disebutkan terbuka | *(DIGANTIKAN Ruang Kendali Studio, Okt 2026 — riwayat saja, jangan dibangun ulang.)*  Desain bebas ditolak, dan acuan yang dikirim adalah frame 01. Versi yang dipampatkan ke 790 (kartu statistik 146, grafik 96, tabel dua baris) tidak lagi dipakai: kartunya kini persis frame — kas 174, aksi 72, statistik 174, arus kas 321, tabel 353, Statistik 460, Perlu Ditangani 408 (terukur). Frame setinggi 1034, jadi di 1440x790 area isinya menggulir 228px (1366x768: 250px); rel, kepala, dan kaki tetap diam, dokumennya sendiri 0. Dashboard satu-satunya halaman yang begitu — 37 halaman lain tetap 0 pada kedua ukuran. Kalau pemilik memilih tanpa gulir, versi terpampat ada di riwayat git (commit sebelum 8d53b01) |
| **Isi Ctrl K, Notifikasi, dan Pesan = DAFTAR GAMBAR + PRATINJAU LEMBAR, DAFTAR REVISI, SURAT PENGANTAR DI ATAS TUMPUKAN (menunggu ACC)** — sekeluarga dengan navbar dan sidebar | Permintaan pemilik "isi dari ctrl k, notifikasi dan pesan masuk … di-upgrade menyesuaikan", sesudah navbar di-ACC. Rancangan DITANYAKAN DULU lewat sketsa ASCII (selera #13), satu pertanyaan per panel; dipilih ketiga yang direkomendasikan. (1) **Palet Ctrl K** (`kit/Palet.tsx` + `PaletPanel.tsx`): KOP BERSEL (`KopBersel`, satu komponen untuk palet dan kedua panel: Cari lembar · Set gambar N lembar · Map proyek N map · Revisi = tanggal REV sampul rel), tabel No. · Judul lembar · Kategori · Rev bergaris bawah rangkap, kelompok per KOTAK HURUF DISIPLIN seperti rel (U P R K G, lalu M map proyek dan A aksi; gaya kotak/nama/jumlah SATU blok CSS dengan kepala kategori rel), baris bergaris tipis dengan GARIS POTONG di baris terpilih, kolom REV = segitiga dari `revisiPerLembar()` (kini di `lib/navAdmin`, satu rumusan dengan kolom REV rel), map proyek berkode `kodeProyek` + TANGGA TAHAP tujuh anak tangga di kolom Rev. PRATINJAU di kanan (≥44rem): KERTAS mini berbingkai cetak ganda dan kisi dengan ikon lembar yang DITARIK PENA tiap kali pilihan berganti (dan nomor kop mini menggulung) — atau foto sampul proyek —, jalur kategori, judul, fakta bersel (urutan i/N, revisi), DAFTAR REVISI lembar itu (nama + jenisnya, butir yang sama dengan segitiga), KUNCI DENAH bertinta kertas (`KunciDenah` rel diekspor, mode diam), dan tombol "Buka P-22 · Enter". Notifikasi pindah ke kelompok Aksi (bukan lembar — tidak ikut "5 lbr"), berikon baru `ArsRevisi` (segitiga revisi bernomor; ikon arsitektur kini 39). Galeri UI Component: contoh Command memakai nomor lembar sungguhan dari `daftarLembar()`. (2) **Notifikasi = DAFTAR REVISI**: kop Terbuka N · Lembar M, tabel Rev · Waktu · Uraian · Lembar, dikelompokkan per hari, terbaru di atas, nomor revisi menurut urutan waktu (tertua = 1, `Revisi` kini menerima `batas` supaya "12" tidak jadi "9+"), tenggat kerjaan bertanda TENGGAT amber, kolom Lembar = `lembarUntuk()` tujuan butir (U-04, R-03), seluruh baris satu tombol ke lembarnya; kaki merangkum per sumber (Pesan · Testimoni · Tenggat). (3) **Pesan = SURAT PENGANTAR di atas tumpukan**: kop Belum dibaca · surat bulan ini; surat terpilih utuh — "Surat pengantar", NOMOR AGENDA `SM-YYMM-NN` (urutan masuk di antara SEMUA pesan bulan itu, diturunkan dari data seperti BKM/BKK), CAP status miring (BARU merah = angka di tombolnya; Dihubungi/Prospek/Selesai abu), isian Dari/Perihal/Diterima bergaris titik, cuplikan 3 baris, "Buka surat"; empat surat berikutnya bertumpuk DI BAWAHNYA (tiap tepi lebih sempit dan lebih ke belakang). Menekan satu tepi MENARIKNYA ke atas (gerak 320 ms, padat — versi setengah tembus memperlihatkan tulisan tepi di bawahnya), fokus pindah ke "Buka surat" karena tepinya lenyap (jebakan #39); dibuka lagi = kembali ke bawaan tanpa gerak. Label status pindah ke `STATUS_PESAN` di `lib/admin`, jenis memakai `CATEGORY_LABELS` — salinan lama di panel tidak mengenal "renovation" (jebakan #32). **Cacat yang ketahuan di jalan:** jebakan #79 (cmdk tidak mengurutkan kelompok), dan aturan gerak-dikurangi pena pratinjau kalah kekhususan dari aturan jedanya (jebakan #75) — kini seluruh animasinya di dalam `@media (prefers-reduced-motion: no-preference)`. Terukur: 36 cek alur (palet: kop = rel, kelompok & jumlah = rel, nomor & REV = rel, pena, "bayar"/"P-25"/"pesan masuk"/"kapuas", Buka map, Esc + fokus, Notifikasi di Aksi, lampu meja, gerak dikurangi; revisi: angka = segitiga, nomor N..1, lembar tujuan, ringkasan, tutup/Escape/klik baris; surat: kop = tombol, teratas = terbaru belum dibaca, nomor agenda, tumpukan, tarik + fokus, Enter, Buka surat, buka ulang, tutup; 8 muat tanpa galat), audit tumpang-tindih `elementFromPoint` + hiasan termasuk pseudo-elemen 0 di 36 konfigurasi (3 lebar × 2 tema × 6 keadaan; terbukti merah saat garis potong, segitiga butir, segitiga revisi, dan tepi tumpukan digeser), `potong.mjs` bersih di 2 halaman × 5 ukuran × 3 panel (terbukti merah 196/25/21; cuplikan surat di ponsel dipotong 3 baris DENGAN SENGAJA), kontras ≥ 3 kedua tema termasuk hover (terendah 3,37 terang, 5,04 gelap), regresi navbar 68/68 dan rel 82/82, astro check 0 galat |
| **Navbar = KEPALA LEMBAR + STEMPEL REV** — sekeluarga dengan sidebar set gambar kerja; di-ACC pemilik 8 Okt 2026 | Permintaan pemilik "sekarang navbarnya sesuaikan juga", sesudah sidebar di-ACC. Rancangan DITANYAKAN DULU lewat dua sketsa ASCII (selera #13); dipilih "Kepala Lembar + Stempel" (bukan "Kop Mendatar"). Tiap halaman satu lembar di set gambar, jadi kepalanya kepala lembar. Kiri: KOTAK NOMOR LEMBAR (sel ikon arsitektur lembarnya + sel "LEMBAR / P-22", bingkai tinta judul) dan JALUR KATEGORI di atas judul ("PEKERJAAN › KEUANGAN · 10 / 32" — "i / N" sesudah peran terbaca, "lampiran" untuk halaman turunan, "Set gambar · di luar daftar" untuk Notifikasi). Semuanya dari `daftarLembar()` + `posisiLembar()` di `lib/navAdmin.ts` — `posisiLembar` kini SATU rumusan untuk kop rel dan kepala (jebakan #32); `Lembar` membawa `ikon`; `daftarLembar()` dihitung sekali. Kanan: CARI LEMBAR (kotak cari kit + tuts "Ctrl K"/"⌘ K", prop `tuts` baru di `Cari`; di bawah 78rem jadi tombol bulat berkaca pembesar yang isiannya tetap ada — klik dan papan ketik masih membuka palet), STEMPEL REV untuk Terbitkan (cap karet bercincin rangkap; tanggal revisi = `tanggalRevisi()` yang kini di `jamStudio.ts`, sama dengan REV sampul rel; keadaan "Sudah tayang" hijau / "Ada perubahan" amber / "Terbit m:ss" / "Memeriksa" — MENGGANTIKAN tombol bola dunia), LAMPU MEJA GAMBAR untuk tema (ikon baru `ArsLampuMeja`: cahayanya hanya menyala di tema gelap; lengan berayun dan cahaya memudar lewat Web Animations dari penangan klik — tanpa `fill`, tanpa kelas), SURAT PENGANTAR untuk Pesan (ikon baris Pesan Masuk di rel + tag angka merah di luar kotak ikonnya), SEGITIGA REVISI berangka untuk notifikasi (komponen `Revisi` dari `kit/Nav` diekspor; sumber yang sama dengan kolom REV rel; kosong = segitiga tinta tanpa angka). Tombol menu ponsel berikon `ArsSetGambar`. Ikon arsitektur kini 38. GERAK — hanya karena perbuatan: pindah lembar lewat router menggulung nomor lembar di jendelanya dan menggambar ikonnya dengan pena (penanda `html[data-kl-pindah]` dipasang pada dokumen BARU di `astro:before-swap` kalau nomornya berganti, dilepas 1,3 detik sesudah `astro:after-swap` — muat penuh tidak melewati peristiwa itu, jadi tidak ada gerak saat dimuat, dan tidak ada nomor yang sempat tergambar diam sebelum hidrasi); menekan Terbitkan MENCAP stempelnya (`kl-cap` + cincin tinta), tanggalnya menggulung saat revisi barunya tayang; menyentuh tombol menggambar ulang ikonnya. Tinggi kepala tetap 38 (jalur 12 + judul 25) — ke-32 halaman tetap satu layar. Ponsel: dua baris, judul 18, "· i / N" disembunyikan (ada di kop laci), sel ikon kotak lembar dilepas di halaman bertombol kembali. **Kode lama yang DIBUANG:** blok CSS "NAVBAR — bilah diam", prop `tanda`/`nadaTanda` milik `TombolBulat` beserta `.k-bulat__tanda` (tidak ada pemakainya lagi), aturan ponsel lama yang melebarkan kotak cari, `tanggalRevisi` salinan di RelKit. `KepalaHalaman` kit mendapat `label` (di atas judul) dan `lambang` (sebelum judul); `TombolBulat` mendapat `isi`. **Cacat yang ketahuan di jalan:** jebakan #77 (`[pathLength]` membuat gaya tertinggal) dan #78 (React 19 menulis ulang ikon tiap render — lengan lampu tidak pernah berayun; perbaikannya di `kit/Ikon.tsx`, berlaku untuk seluruh panel). Terukur: 68 cek alur (ke-32 lembar: nomor, jalur, kop rel sama, REV sama sampul, tinggi 38, tanpa gerak muat; lampiran & di luar daftar; staf 30/30; router: penanda terpasang, nomor menggulung, pena bertahap, atribut lepas dan ikon utuh; nomor sama tidak menggulung; gerak dikurangi; lampu: diam saat muat, berayun, cahaya menyala/padam, tanpa animasi tersisa; stempel: Sudah tayang → Ada perubahan → dicap → Terbit m:ss → Escape; cari: tuts, klik, "P-25", Ctrl+K; angka pesan & segitiga = label; panel buka/tutup; ponsel 0 geser + cari bulat + laci; lebar cari 38/282; 8 muat × 3 tanpa galat), audit tumpang-tindih kepala 0 di 8 konfigurasi (terbukti merah: cincin stempel 16, bingkai kotak lembar 16; temuan pertama — angka pesan di atas pojok ikon — diperbaiki dengan memindah tagnya), `potong.mjs` (`AKAR=".kl__kepala"`) bersih di 10 halaman × 5 ukuran (temuan ponsel "· 25 / 32" terpotong diperbaiki), kontras kepala ≥ 3 di kedua tema termasuk stempel amber, hover, lampu ditekan, panel terbuka; uji rel 82, Dashboard 81+34+33, ke-32 halaman 0 gulir pada 1440x790 & 1366x768; astro check 0 galat. Pemindai kontras halaman melaporkan "/" remah di Proyek Baru (1,81) — remah lama, warna frame, bukan bagian navbar |
| **Sidebar = SET GAMBAR KERJA luar-dalam: sampul + kunci denah, daftar bertabel, 36 ikon arsitektur, kop gambar** — di-ACC pemilik 8 Okt 2026 (putaran 2, menggantikan putaran pertama) | Putaran pertama (nomor lembar + penanda + kop di atas pil Coinest) dinilai pemilik "1 dari 100": "secara menyeluruh … icon dll juga harus di-custom … luar dalam animasi semuanya … kode lama hilangkan, jangan ada double code". Bendanya tetap DAFTAR GAMBAR satu set gambar kerja, kini dari kepala sampai kaki: (1) **SAMPUL** `--kas-bidang` berjahit (outline putus 5px dari tepi, bahan papan uang yang sudah di-ACC): logo studio (Info Studio, dibaca saja — kunci `settings`) atau MONOGRAM di segi enam, nama studio, "Set gambar · N lembar", dan **REV** = tanggal build (`CAP_BUILD` → "08.10.26"). (2) **KUNCI DENAH** di dasar sampul: satu ruang per kategori, lebar sebanding jumlah lembarnya, dinding luar tebal, sekat tipis, celah pintu; ruang lembar yang dibuka DIARSIR dan arsirnya SATU elemen yang meluncur antarruang (460 ms) tiap pindah halaman. Menunjuk ruang (tetikus saja) menyorot kepala kategorinya; klik menggulir daftar ke sana dan kepalanya berkedip 1,2 detik. (3) **KEPALA TABEL** No. · Judul lembar · Rev bergaris bawah rangkap, di luar daftar yang menggulir. (4) **DAFTAR** bertabel: baris 28px bergaris bawah tipis, kolom nomor (U-01 …, seri puluhan untuk kategori bersubmenu — `daftarLembar()` di `lib/navAdmin.ts`, tetap satu sumber untuk rel, kop, palet), kepala kategori = kotak huruf disiplin + "N lbr", submenu dengan garis pohon + takik, GARIS POTONG di lembar yang dibuka, dan kolom **REV** berisi SEGITIGA REVISI per halaman dari `revisiPerHalaman()` (`lib/notifikasi`, sumber yang sama dengan lonceng; dikirim `KepalaKit` lewat peristiwa `kit:revisi` yang MENGGANTIKAN `kit:pesan`); halaman turunan ikut seri induknya lewat awalan path terpanjang, dan induk yang tertutup menjumlahkan anaknya. (5) **36 IKON ARSITEKTUR** buatan sendiri (`components/kit/ikon/arsitektur.ts`): lembar gambar, peil, daftar periksa, surat pengantar, panah utara, tampak rumah, kurva S, kartu indeks, skala manusia, awan revisi, buku sketsa, fasad, meja gambar, jangka, ordner, kunci rumah, nota paku, mesin kas, kuitansi, buku gaji, amplop gaji, garis ukur, stempel, pintu, dan seterusnya — garis `pathLength="1"`, bidang isi berkelas `isi`. Semua 35 entri `ikonKit` di `navAdmin` menunjuk ke sana; galeri UI Component menampilkannya di folder Ikon (215 bentuk = 36 arsitektur + 179 Coinest). (6) **KOP GAMBAR** di kaki: "Digambar · Master/Staf", nama, tombol Keluar berikon PINTU yang daunnya berayun 64° di engselnya saat disentuh; sel LEMBAR (nomor, "i / N", "lampiran", "di luar daftar") dan TANGGAL + jam studio. **GERAK** — semuanya karena perbuatan, tidak saat dimuat dan tidak saat data datang (jebakan #74), diam bila gerak dikurangi: PENA menggambar ikon lembar yang baru dibuka garis demi garis (720 ms, jeda 70 ms per garis, bidang isi menyusul; kelas `is-ditarik` dilepas sesudah 1,1 detik), menyentuh baris menggambar ulang ikonnya (KECUALI lembar yang sedang dibuka — kalau tidak, kursor yang masih di atasnya menggambar ikon yang sama dua kali begitu kelas pena lepas), penanda potongan + arsir denah meluncur, garis potong tergambar, submenu yang dibuka menurunkan garis pohonnya lalu ISI barisnya terurai berurutan (jebakan #76), nomor kop menggulung di dalam jendela barisnya sendiri. `useBaru(kunci, umur)` di `kit/Nav.tsx` yang menentukan "baru": kosong → berisi tidak dihitung, pengatur waktunya di ref. **Kode lama yang DIBUANG:** pil Coinest, rel sempit 72px, garis tepi per baris, varian `gambar` (SisiNav kini SATU bentuk; prop `varian`/`kelompokKode` hilang, `sampul` menggantikan `kepala`), garis penghubung bertitik, `kit:pesan`, `title` di label menu (tidak ada yang terpotong, jadi keterangan melayangnya cuma menutupi baris di atasnya), dan `.gal-rel .k-sisi--gambar`. **Cacat yang ketahuan di jalan:** peran master hanya dibaca sekali saat rel dipasang — profil yang disegarkan `/me` mengganti kartu akun tapi tidak daftar lembarnya; kini `PERISTIWA_PROFIL` ikut menyetel peran. Tema gelap: kepala kategori yang disorot dari denah 1,99 dan induk-aktif 3,22 → tinta `--text-strong` dan campuran mint 78% (5,33). Lebar rel tetap 240 (jebakan #41). Terukur: 82 cek alur (ke-32 halaman: baris aktif, penanda ±0,5 px, kop, garis potong, arsir di kategorinya, tanpa gerak muat; staf 30 lembar; router + rel tidak dipasang ulang; pena berjalan lalu lepas; segitiga REV termasuk penjumlahan seri P-10/P-20; denah: lebar sebanding, sorot, gulir; submenu terurai; gerak dikurangi; laci; papan ketik; 8 muat × 3; galeri; palet), audit tumpang-tindih 0 di 9 konfigurasi termasuk laci 390/1024, hover, dan denah disorot — alatnya membaca letak pseudo-elemen dari gaya TERHITUNG dan terbukti merah (pohon 24, pratinjau 1, arsir 28, takik 8, jahitan 99, garis 27); **alat itu sempat buta (jebakan #36)**: kelonggaran "tulisan milik hiasan itu sendiri" ikut berlaku untuk pseudo-elemen, padahal pemilik garis pohon adalah SUBMENU yang memuat seluruh barisnya — garis pohon yang sengaja digeser ke nomor lembar lolos 0 temuan. `potong.mjs` (`AKAR="#kl-rel"`) bersih dan terbukti merah 15; kontras bersih kedua tema TERMASUK keadaan hover, induk-aktif, kepala disorot, dan Keluar disentuh (`kontras-keadaan.mjs` di sesi — `kontras.mjs` tidak melihat keadaan); ke-32 halaman 0 gulir dokumen/isi/rel pada 1440x790 & 1366x768; uji Dashboard 81+34+33 dan audit 0; astro check 0 galat 0 peringatan. Video dibaca per bingkai (`-ss` + `crop`), digabung lewat Playwright (`gabung.mjs` di sesi — tidak ada PIL dan ffmpeg sesi tanpa `hstack`) |
| **Dashboard = RUANG KENDALI STUDIO — sesudah frame-01-ditambal dan TAMPAK BANGUNAN ditolak** — di-ACC pemilik 8 Okt 2026 (putaran upgrade: cincin kode, mode fokus, bulan dibaca, jam studio) | Dua penolakan berturut-turut: frame 01 yang ditambal ("lah kok sama aja … saya berikan kamu kebebasan") dan tampak kawasan — proyek sebagai bangunan berlantai termin ("jelek banget … dashboard yang sesuai dengan arsitek punya … max pro"). Pelajarannya: untuk Dashboard, metafora bergambar (bangunan) terbaca mainan; yang dimau adalah DASHBOARD SUNGGUHAN yang pro, dengan bahasa kantor arsitek. Kali ini rancangan DITANYAKAN DULU (pemilik minta "sebelum membuat berikan seperti apa"): dua sketsa ASCII lewat AskUserQuestion, dipilih "Ruang Kendali Studio". Susunannya di papan `--kas-bidang` berjahit dengan benda pejal `--kas-dalam`: (1) KOP GAMBAR selebar papan — kotak judul (studio, tanggal, pemeriksa = bagian lokal email + peran) dan lima sel bernomor 01–05 bergaris rangkap: kas masuk, beban, laba bulan ini (angka penuh, garis enam bulan berbasuhan, pembanding bulan lalu), piutang (meteran bagian lewat tempo, amber), proyek berjalan (meteran kontrak yang sudah masuk; sebaran tahap di kartu keterangan). Tren persen SENGAJA tidak dipakai: bulan berjalan baru sebagian, jadi "turun 90%" menyesatkan — yang ditulis angka bulan lalu. (2) JADWAL INDUK — time schedule proyek berjalan (urut mulai): batang dari tanggal termin/tenggat pertama sampai terakhir (tanpa tanggal mulai di data proyek, ini satu-satunya rentang jujur), isi mint = bagian tahap yang dilalui (% selesai ala Gantt), paku termin lunas/terbit/lewat/draf, belah ketupat tenggat preview (di atas batang) dan final (di bawah; amber bila terlewat sebelum Finish), garis HARI INI bercahaya + pita tanggal, GARIS BIDIK putus yang mengikuti tetikus dengan tanggalnya (kotak dibaca sekali saat masuk, ditulis lewat ref), jendela delapan bulan digeser ‹ › / "Bulan ini". Seluruh posisi dalam persen dari satu fungsi `pos()` — kepala bulan, kisi, dan lajur tidak bisa menyimpang. Tidak ada tulisan di kolom waktu (jebakan #70). (3) Kanan: ARUS KAS 12 bulan (bidang mint berbasuhan + garis beban putus, kartu per bulan) yang ditutup LACI DETAIL — kertas putih tetap yang MELUNCUR dari kanan saat satu lajur diklik/Enter (↑/↓/Home/End memindah, Escape/klik lagi/× menutup, `inert` saat tertutup): kode, klien·kota·jenis·tahap, Kontrak/Diterima/Biaya/Laba (berhitung), daftar termin satu baris per termin yang memudar di tepi bila panjang, tiga jalan pintas. (4) Bawah: AGENDA 14 HARI (pita hari dengan titik per jenis + dua acara terdekat, yang LEWAT lebih dulu: termin terbit lewat tempo dan tenggat final terlewat sebelum Finish), PERLU DITANGANI (3), BUSUR TARGET semester dengan penanda amber "seharusnya" = bagian semester yang sudah lewat, dan empat jalan pintas. Yang dibuang dari versi frame 01: donat Statistik, tabel Laba per Proyek, kartu kas miring (isinya kini di kop, laci, dan keterangan). `dash-kit.css` dan `tampak-kit.css` dibuang; gaya di `kendali-kit.css`. Tanpa migrasi dan tanpa endpoint baru. Terukur: 0 gulir dokumen/isi pada 1440x790 & 1366x768 (Dashboard satu layar lagi), 0 geser di 390 (jadwal menggulir mendatar di kotaknya sendiri), kontras bersih kedua tema, audit tumpang-tindih `elementsFromPoint` 0 di 10 konfigurasi termasuk laci terbuka (terbukti merah saat nama dan sumbu didorong ke bidang). **Alat audit sempat buta dua kali (jebakan #36):** teks berelipsis dilaporkan menindih batang karena Range ikut bagian yang tersembunyi (kini dipotong ke kotak leluhur ber-overflow), dan tulisan di laci dilaporkan menindih grafik di BAWAH kertas buram (kini hiasan di luar laci diabaikan untuk teks di laci). 47 cek alur (kop = API bulan ini, lajur = proyek berjalan urut mulai, paku ⊆ termin, garis hari ini sejajar pitanya dan jatuh di bulan ke-5, geser/kembali, laci meluncur + angka = API + papan ketik + Escape + inert, bidik, keterangan, kas bersih, agenda, gerak dikurangi, 8 muat tanpa galat). **Putaran upgrade (pemilik: "upgrade lagi … pastikan ga ada bug"), di dalam benda yang sama:** (1) JADWAL lebih tegas — CINCIN KODE di depan tiap lajur (busur = bagian kontrak yang sudah diterima, foto sampul proyek di lubangnya bila ada, kode bila tidak/gagal dimuat — tidak keduanya; titik amber di pundak = termin lewat tempo atau tenggat final terlewat sebelum Finish, dan jumlahnya di kepala "N perlu perhatian"), batang 16px dibagi TUJUH SEKAT tahap pipeline, UJUNG PENA bercahaya di tahap kini, pita bulan berjalan di kisi, dan lajur yang tidak muat menggulir dengan tepi memudar (ukuran di-cache lewat ResizeObserver; handler gulir hanya membaca scrollTop — jebakan #21). Lajur kini MEMADAT (`flex: 0 1 45px`, lantai 38px) alih-alih tinggi tetap — tinggi tetap kurang 1–11px di 1366/1300 dan menyalakan tepi pudar tanpa perlu. (2) MODE FOKUS: menyentuh lajur (tetikus saja) memundurkan lajur lain ke 38% — lajur yang DIPILIH tetap di depan; SOROT SILANG agenda↔jadwal (hari dan acara menyorot proyeknya, lajur menyorot acaranya). (3) BULAN DIBACA: bulan di arus kas adalah tombol (roving tabindex, ←/→/Home/End); memilihnya membuat sel kop 01–03 membaca bulan itu (angka berhitung, garis enam bulan berakhir di bulan itu, baris "Membaca" di kotak judul), pita bulan meluncur, dan keping "Kop: Agu 2026 ×" mengembalikan; klik bulan yang sama / bulan terakhir / End = kembali. Bulan kosong: pita dan titik disembunyikan. (4) Kurva arus kas MONOTON (Fritsch–Carlson) — halus tanpa melewati data. (5) Kotak judul: jam STUDIO menurut zona Info Studio (`Intl` + WIB/WITA/WIT, diperbarui di batas menit) dan logo studio; laci memuat foto sampul proyek dan TANGGA TAHAP tujuh ruas di samping nama tahap — klien·kota·jenis yang berelipsis, tahap tidak pernah terpotong (versi pertama memotong "tahap Desai…"). (6) Label kop memakai bulan PENDEK ("Okt") di 1288–1408 dan ponsel: teks lepas di flex tidak pernah berelipsis, dan "LABA BERSIH · OKTOBER" terpotong diam-diam di 1300/1366. Ponsel: sel 05 selebar kop, kalimat kepala jadwal boleh terlipat (sempat meluber keluar kartu). **Alat potong sempat buta (jebakan #36):** audit lama hanya memeriksa elemen tanpa anak dan melewati SEMUA yang menyatakan `text-overflow: ellipsis` — padahal elipsis tidak menyala pada simpul teks lepas di dalam flex. Sekarang tiap simpul teks dibandingkan dengan setiap leluhur pemotong (penampung gulir, `.sr-only`, dan `display: contents` dilewati) DAN dengan kartu terdekatnya (luberan tanpa pemotong); terbukti merah pada cacat lama (label 1366/1300/390, tahap laci, kepala jadwal ponsel). Uji kasus tepi lewat `route.fulfill`: 0 proyek, 10 proyek (gulir + pudar), tagihan 500, bulanan kosong, zona WITA + logo + sampul rusak, laci di 390/1024. Terukur: 0 gulir pada 1440x790, 1366x768, 1300x760, 1440x900; 0 geser di 390; audit tumpang-tindih + potong + luber 0 di 10 konfigurasi; kontras bersih kedua tema; 81 cek alur + 34 kasus tepi + 33 cek putaran ini, 0 galat. **Peta berkas:** `components/admin/DashboardKit.tsx` (Cincin, Jadwal, Laci, ArusKas, Agenda, kop di `Isi`) + `styles/kendali-kit.css` (awalan `rks__`, variabel lokal `--rks-*`); data dari `ambilNotifikasi` (proyek, tagihan, milestone), `ambilRingkasanKeuangan`, `ambilBulanan`, `ambilSettings` (dibaca saja — kunci `settings` milik Info Studio, jebakan #8) dan `useKemajuanTarget`; kunci cache MILIK halaman ini `dasbor-notif`, `keuangan:semua`, `keuangan-bulan:semua`. Angka berhitung lewat `Hitung` di `components/admin/hitung.tsx`; jam studio `jamStudio()` memakai `Intl` + zona `StudioSettings.timezone`. **Cara mengujinya lagi:** bangun + sajikan `dist`, API tiruan di :8787; potret 1440x790/1366x768/1300x760/1024/390 kedua tema; `node scripts/banding/potong.mjs /admin/` dengan `KARTU=".rks__kotakjudul, .rks__sel, .rks__jadwal, .rks__kanan > *, .rks__bawah > *, .rks__laci, .rks__papan"`; `kontras.mjs /admin/`; audit tumpang-tindih `elementsFromPoint` dengan hiasan `.rks__kisi i/u, .rks__kini, .rks__bidik, .rks__batang(+ i), .rks__sekat, .rks__ujung, .rks__paku, .rks__tenggat, .rks__arusbaca, .rks__cincin svg/img, .rks__lacifoto, .rks__logo, .rks__tangga i` (kode di lubang cincinnya sendiri dikecualikan); kasus tepi lewat `route.fulfill` (0 proyek, 10 proyek, tagihan 500, bulanan kosong, zona WITA, sampul rusak); video lewat `recordVideo` + bingkai ffmpeg `-ss`. **Deploy run #161 gagal karena TAGIHAN GitHub (jebakan #73), bukan kode — begitu dibereskan, dorong ulang branch kerja ke produksi.** |
| **Dashboard: angka PENUH, sumbu arus kas dari data, kartu setinggi isinya; kepala tabel melengkung dan menempel** | *(DIGANTIKAN Ruang Kendali Studio, Okt 2026 — riwayat saja, jangan dibangun ulang.)*  Permintaan pemilik sesudah melihat produksi. (1) Angka "Rp35.000.000", bukan "Rp35 jt" — di seluruh Dashboard dan kartu Target (`targetKit`, ikut Kas Studio); yang sempit ditata ulang, bukan diringkas: Proyek/Piutang kartu kas turun ke baris sendiri, total tab Statistik di bawah labelnya, catatan tabel tiga baris, kolom tabel 150/92/84/150/78 (jumlah tetap 554). Hanya label sumbu grafik yang tetap ringkas. (2) Sumbu arus kas tidak lagi ±maks yang dibulatkan ke pangkat sepuluh (kas 110 jt jadi sumbu ±200 jt, batang seperempat bidang): langkah 1/2/2,5/3/4/5×10^k dari seperlima rentang, bagian atas setinggi kas tertinggi, bawah setinggi beban tertinggi, garis nol di tempat datanya — batang Juni 37px → 74px. Batang tetap mulai dari NOL. `KolomGrafik` menerima `garis`, `LabelYGrafik` membagi rata sebanyak labelnya. (3) Kartu Statistik setinggi isinya (auto layout), Perlu Ditangani naik mengisi. (4) Kepala tabel bermint bersudut 8 di atas (`border-collapse: separate`, jarak 0) dan setiap `thead th` kit `sticky` — terukur menempel di Semua Transaksi, Keuangan, Tugas |
| **Ikon urut (⇕) di kepala tabel BERFUNGSI** — sebelumnya hiasan frame | Laporan pemilik: "pastikan klik atas bawah itu berfungsi". `Tabel` kit: judul kolom ber-`urut` jadi tombol (`aria-sort`) kalau pemanggil mengirim `urutan` + `onUrut` — klik pertama naik, kedua turun, ketiga kembali ke urutan asal; panah yang berlaku menyala, lawannya pudar. Yang MENGURUTKAN pemanggil lewat `useUrutTabel(data, nilai[])` dari `kit/Tabel`, dengan kunci per kolom yang berupa DATA (angka bertanda untuk nominal, milidetik untuk tanggal, urutan termin) — bukan teks sel, karena "Rp170.000.000" dan "4 Okt 2026" salah urut sebagai teks. Tabel berpaginasi (Tagihan, Semua Transaksi lewat `DaftarKit`) diurutkan SEBELUM dipotong per halaman dan kembali ke halaman 1. Kolom Catatan di Dashboard diurutkan menurut sisa piutang, bukan abjad kalimatnya. Terukur: 123 pengecekan di 8 tabel (Dashboard, Fee per proyek & per orang, Semua Proyek, Keuangan, Satu Proyek, Tagihan, Semua Transaksi) — tiap kolom naik, turun, dan kembali asal benar; urut lintas halaman terbukti di Semua Transaksi. **Kalau menambah kolom `urut: true`, kirim juga kunci urutnya** — ikon tanpa `onUrut` kembali jadi hiasan |
| **Tanpa tampilan bawaan peramban di panel kit** | Permintaan pemilik: "dropdown tidak default google … pastikan tidak ada yang berkaitan dengan default". Seluruh `<select>` asli diganti `PilihMenu` (Radix Select berkulit kit, `kit/Formulir`) — pemicunya bebas (tombol, teks, titik status, kotak isian); menu AKSI memakai `DropdownMenu`. Ini membalik alasan lama "select asli tidak bisa rusak diam-diam": papan ketik dan ketik-untuk-melompat tetap milik Radix. `title` digambar sebagai keterangan kit oleh `lib/judulMelayang.ts` (dipindah ke `data-judul` begitu muncul), `confirm()` diganti `lib/tanya.tsx`. Yang TIDAK bisa diganti: kotak "tinggalkan situs?" saat menutup tab (`beforeunload`) — peramban selalu memakai miliknya |
| **Setiap grafik menjawab "berapa" saat kursor di atasnya** | Permintaan pemilik. Satu kartu (`kit/kartuGrafik.tsx`, portal + `fixed` supaya tidak terpotong kartu induk) untuk Busur, Donat, Cincin, Kilau; `GrafikArea` menerima `keterangan(i)`, `KolomGrafik` menerima `keterangan` + `sisiKartu`. Label angka di atas batang Beban per Tahun dibuang — ia menimpa batangnya sendiri begitu tinggi plot mengecil |
| **Teks keterangan dipangkas** | Pemilik: "text keterangan itu tidak perlu". Paragraf penjelasan, bantuan isian, dan deskripsi dialog yang cuma menjelaskan dibuang; peringatan hapus diringkas jadi satu kalimat akibat. Yang TETAP: galat validasi, alasan tombol mati, dan peringatan yang mengubah keputusan (bentrok jatah bonus di Aturan Fee). Penjelasan panjang pindah ke `/admin/panduan` |
| **Alur Excel pemilik jadi data: tim per PERAN, bayaran BERTAHAP, kas studio, target SEMESTER** (migrasi `20261004000027`, fase 1) | Dari berkas "LIST PROJECT DESIGN — mulai 17 Mei 2025" + jawaban pemilik. (1) **Tim per peran** (`project_team`): Leader, Drafter, Render, Estimator; satu peran boleh dua orang. Yang disimpan cuma PERSEN — nominal selalu dihitung dari fee design (nilai kontrak), karena Excel-nya sendiri mencatat fee Weng Rp12 jt di satu sheet dan Rp8 jt di sheet lain. Persen bawaan di `studio_fee_settings` (tabel sendiri, BUKAN `studio_settings` yang terbaca anon): Drafter 10, Render 5, Leader dan Estimator KOSONG = "belum ditentukan" (jawaban pemilik), bukan nol. Persen yang sudah ditentukan DIBEKUKAN di penugasan saat ditambahkan; yang kosong ikut aturan studio begitu pemilik mengisinya. (2) **Bayaran bertahap**: "5% dulu, sisa tunggu design selesai" = tahap awal (bawaan 50% hak) jatuh tempo saat DP klien masuk — pembayaran berjenis DP ATAU tahap pipeline sudah melewati DP 50% — dan tahap akhir saat pipeline ≥ Finish. Yang dibayar TETAP tercatat di `project_costs` (aturan "Fee menulis, Gaji membaca" tidak berubah), bertaut lewat `project_team_id` + `payout_stage`, dengan indeks unik supaya satu tahap tidak bisa dibayar dua kali; penugasan yang sudah dibayar tidak bisa dihapus. (3) **Kas studio** (`studio_ledger`): pemasukan dan pengeluaran di luar proyek — penjualan material (PVC), bagi hasil, konsumsi, operasional — tabel sendiri, bukan melonggarkan `project_costs.project_id`; gaji TIDAK dicatat di sini. Ketahuan sekalian: produksi tidak pernah bisa mencatat biaya tanpa proyek — "Sewa kantor" tanpa proyek di tangkapan layar lokal cuma ada di API tiruan. (4) **Target** (`revenue_targets`): per semester (1 Jan / 1 Jul), target PEMASUKAN — bukan laba seperti rumus Excel — dan penjualan PVC ikut dihitung (jawaban pemilik). Tercapai = `project_payments` + kas masuk; semester tanpa baris memakai target terakhir. **Beda sumber yang sengaja dicatat:** "Kas masuk" di Keuangan masih membaca invoice lunas, target membaca pembayaran sungguhan — disatukan di fase 4. **Bentrok yang belum diputuskan pemilik:** "FEE BONUS 10%" = jatah bonus satu proyek, tapi Drafter 10% + Render 5% sudah 15%; jatahnya disimpan sebagai pembanding, tidak membatasi. (5) Jenis proyek **Coffee shop** (`coffeeshop`), muncul di rel /proyek publik hanya kalau sudah ada proyeknya |
| **Fase 2: Proyek Baru = form PEKERJAAN, Satu Proyek punya Tim & Bayaran, halaman Aturan Fee Tim** (migrasi `20261004000028`) | Kolom LIST PROJECT di Excel jadi isian: klien, jenis, nama (boleh kosong = nama klien), kota, alamat, **lingkup kerja**, fee design (= nilai kontrak), **tenggat preview dan final**, dan tim per peran dengan rupiah yang dihitung saat diketik. Lingkup kerja kolom sendiri di `projects`, BUKAN `project_briefs.requirements` — yang itu milik klien dan bisa ia timpa dari `/progres`. Tenggat kolom `date` dengan CHECK final ≥ preview; API publik tidak memilih ketiganya. Isian situs publik (sampul, subjudul, ringkasan) dilipat jadi "Bisa nanti". Di Satu Proyek: kartu Lingkup & Tenggat (bisa diubah di tempat) dan Tim & Bayaran — tiap tahap tampil Dibayar / tombol "Bayar Rp…" (jatuh tempo) / "Persen belum ditentukan" / "Tunggu DP klien" atau "Tunggu desain selesai" (bisa diklik untuk bayar lebih awal). Karena seksi itu di bawah lipatan, bilah atas menampilkan "N bayaran tim jatuh tempo" yang menggulir ke sana. `/admin/pengaturan/fee` mengatur persen keempat peran (kosong = belum ditentukan, bukan nol), bagian tahap awal, dan jatah bonus — dan menampilkan TERBUKA bahwa Drafter 10% + Render 5% = 15% melebihi jatah 10% (bentrok yang belum diputuskan pemilik). API tiruan kini menangani buat/ubah proyek, aturan fee, penugasan, dan bayar tahap, jadi alurnya bisa diuji ujung-ke-ujung (`/tmp/uji01/f2/alur.mjs` di sesi). Hapus penugasan menjaga fokus papan ketik sendiri: cadangan `lib/fokus` ada di baris yang sama dan ikut lenyap |
| **Fase 3: halaman Bayaran Tim (`/admin/gaji/tim`) — hak vs dibayar per orang, dan slip gaji** | Pengganti sheet "GAJI ADJI / DANY / RAFFI". Kiri: semua anggota aktif dengan terutang dan lencana "jatuh tempo"; orang yang hak-nya Rp0 karena persennya kosong tertulis "tanpa persen", BUKAN "lunas". Kanan: slip bulan terpilih (gaji pokok + tiap fee yang TERJADI bulan itu, dengan proyek, peran, persen, tahap) dan Hak per Proyek dengan tombol Bayar yang sama dengan Satu Proyek — `SelTahap` dan `DialogBayar` kini diekspor `timProyekKit.tsx`, bukan disalin. Slip dari endpoint sendiri `GET /payroll/slip?teamMemberId=&period=` (bukan `/costs` yang dibatasi 200 baris) dengan saringan yang SAMA PERSIS dengan `payroll.bulan()`, jadi total slip = kolom Total di Gaji (dijaga tes). Unduh PDF memakai `lib/pdf.ts`; "Kirim ke WhatsApp" membuka `wa.me/62…` dengan teks slip — nomor diambil dari Tim & Freelancer dan dinormalkan (0812… / +62 812… → 62812…), tombolnya mati dengan alasan kalau nomornya kosong. Tidak ada angka yang DIKETIK di halaman ini. Penerima di kartu Gaji membuka slipnya. Tabel hak 3 kolom (kedua tahap ditumpuk) karena 6 kolom tidak pernah muat di samping slip |
| **Fase 4: Kas Studio, Target Semester, proyek ↔ paket, KPI Strategi** (migrasi `20261004000029`) | (H5) `/admin/keuangan/kas` = sheet KELUAR MASUK untuk uang di LUAR proyek (PVC, bagi hasil, konsumsi, sewa) — halaman sendiri, bukan pintu kedua: pembayaran klien, biaya proyek, dan gaji tetap di tempatnya; Semua Transaksi kini memuat ketiga tabel (`studio_ledger` ikut, saringan proyek punya "Kas studio"). Kunci cache `kas-studio` milik halaman Kas; Semua Transaksi cuma membacanya (jebakan #8). Hapus dua langkah ("Hapus" → "Ya, hapus"). (H6) Kartu **Target Semester** (`targetKit.tsx`, satu sumber) MENGGANTIKAN kartu Laba Bersih kumulatif di Dashboard — angka itu tetap di Keuangan → Ringkasan; kalimat sisanya SATU baris karena baris kedua memotong kartu Proyek Berjalan di bawahnya (terukur). Target semester ini dan berikutnya diubah dari Kas Studio. (H7) `projects.tier_id` (boleh kosong, `on delete set null`) dipilih di Proyek Baru dan di dialog Lingkup & Tenggat (`pilihPaket.tsx`, satu komponen), dengan peringatan — bukan penolakan — kalau fee di luar rentang paketnya. `service_tiers.price_changed_at` hanya bergeser saat FEE berubah (trigger; `updated_at` ikut bergeser saat teks disunting); kartu di `/admin/paket` menghitung proyek berpaket yang dibuat sesudah stempel itu dan sudah ≥ Finish, dan jadi amber "3 selesai — saatnya naik 10–15%" (§3.3). (H8) `/admin/kpi` menghitung lima angka §8 di SERVER (`repository/kpi.ts`, bukan dari `/costs` yang dibatasi 200 baris): rata-rata kontrak (Rp50–70 jt), margin KONTRAK tertimbang (≥35%, beda dari laba kas), lead kuartal (10–15), proyek "Signature ke atas" = paket berurutan ≥2 di kelompoknya (Signature/Flagship, Standar/Premium — TAFSIRAN, disebutkan ke pemilik), dan cadangan kas = saldo catatan panel ÷ rata-rata keluar per bulan (enam bulan PENUH terakhir, dibagi jumlah bulan yang berdata). Targetnya konstanta `TARGET_KPI`, bukan isian. Warna status: hijau sesuai, amber belum sampai — merah tidak dipakai. Kartu ringkas kit ditumpuk khusus di halaman ini karena lima sebaris tidak muat dalam bentuk aslinya |
