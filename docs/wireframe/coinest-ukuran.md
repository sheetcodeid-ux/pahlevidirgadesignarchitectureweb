# Wireframe 14 halaman admin — angkanya dan cara membuktikannya

Kerangkanya di `coinest.html`, digenerate dari `scripts/buat-wireframe.py`.
Berkas ini mencatat angka bersamanya dan — yang lebih penting — **cara
membuktikan angka itu masih benar**.

## Kerangka bersama, sama di seluruh frame

| Bagian | Kotak |
| --- | --- |
| Bingkai | 1440 lebar |
| Rel samping | 0 → 192 |
| Kolom konten | 220 → 1412 (**1192**) |
| Talang | 28 di kiri kolom, 28 di tepi kanan bingkai |
| Kepala halaman | 1192 x 38, di y22 |
| Kaki halaman | 1192 x 19,5 |

Tinggi framenya berbeda-beda (1024 sampai 2429) karena halamannya memang
berbeda panjang. Body mulai di y80 di sebelas frame dan y96 di dua
(Transactions dan Inbox).

Kolom yang berulang:
- **585 / 282 / 282** — tiga kolom, celah 21. Dipakai Dashboard v2.
- **585 / 585** — dua kolom sama besar, celah 21. Dipakai Investments.
- **385,7 x3** — tiga kartu statistik, celah 17. Dipakai Invoices dan Saving Plans.
- **303 / 903** — kolom kiri sempit + panel kanan. Dipakai Transfer dan Payment.
- **338 / 836** — daftar percakapan + panel pesan. Dipakai Inbox.

## Membuktikannya

Dua alat, dan keduanya perlu — masing-masing menangkap kelas kesalahan yang
tidak bisa ditangkap yang lain.

**1. `python3 scripts/periksa-wireframe.py`** membaca ulang SVG framenya,
mencari layer yang namanya disebut di spek, dan membandingkan keempat
angkanya dengan toleransi 1px.

Hasil terakhir: **60 cocok, 0 beda, 10 tidak bisa diperiksa** (tujuh dari
frame 01 yang belum diekspor, tiga wilayah turunan yang memang tidak punya
layer Figma sendiri).

Satu aturan yang harus ada di alat itu: kalau sebuah layer punya `<rect>`
langsung sebagai anak, **rect itulah panelnya**. Bbox grup Figma ikut memuat
anak yang menjulur keluar panelnya — bayangan, tumpukan kartu hias, kadang
rect klip selebar bingkai. Tanpa aturan itu, empat panel yang sudah benar
terbaca "selisih 800px".

**2. Menumpuk kotak wireframe di atas gambar framenya** (`tumpang-wf.mjs`).
Ini yang menangkap kesalahan yang angkanya tidak bisa tangkap: kotaknya
benar, ISINYA yang salah dikira.

Lima hal ketahuan begitu, dan semuanya sudah diperbaiki di spek:

- `Section Statistic` di Dashboard v2 berisi **empat** kartu 2x2, bukan dua.
- `Widget Cashflow` grafik **area** dua garis, bukan batang.
- `Widget Finance Score` kartu berbar kemajuan, bukan sparkline.
- `Section Plans` di Dashboard v2 isinya **Recent Activities**, jadi
  `BarisAktivitas` — bukan `BarisLog`.
- `Section Plans` di Saving Plans kartu berbar kemajuan, bukan
  `BarisPenyedia`.

## Lima bentuk yang BELUM ADA di kit

Ketahuan dari penumpukan yang sama. Kelimanya dipakai frame Interface dan
tidak ada di lima belas frame Style & Component, jadi ia memang tidak pernah
terbangun di P2:

| Bentuk | Dipakai di |
| --- | --- |
| Bar kemajuan | Dashboard v2 (2x), Saving Plans (2x) |
| Grafik area halus | Dashboard v2, Saving Plans |
| Grafik area bertangga | Investments |
| Busur (gauge) | Investments |
| Kartu statistik LEBAR, ikon di kanan | Saving Plans, Invoices |

Kelimanya harus dibangun sebelum halaman yang memakainya. Membangun
halamannya dulu berarti memasang bentuk pengganti, lalu menggantinya lagi —
dua kali kerja untuk hasil yang sama.

## Frame yang belum ada

`01. Dashboard (v1)` — halaman `/admin`, yang paling sering dibuka pemilik —
**belum diekspor**. Kerangkanya di `coinest.html` disusun dari spesifikasi
enam bagiannya yang sudah ditarik lebih dulu (kiri `3:1127`, statistik
`3:1188`, kolom grafik `3:1210`, kanan `3:1245`, kepala seksi `11:1745`),
jadi proporsinya benar — tapi ia satu-satunya yang tidak bisa ditumpuk
dengan gambar framenya, dan karena itu satu-satunya yang isinya belum
diperiksa dengan cara yang menangkap kelima kesalahan di atas.

Setelan ekspornya sama dengan yang lain: frame `01. Dashboard (v1) -
Desktop`, SVG, taruh di `apps/web/src/assets/figma/interface/`.
