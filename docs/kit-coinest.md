# Kit Coinest — cara mengukurnya, dan apa yang masih beda

Pustaka `k-` dibangun dari lembar kosong mengikuti file Figma **Coinest —
Finance Management Dashboard** (`62HM59sb04oWlZoT3EcCyN`), lima belas frame
Style & Component, satu per satu. Berkas ini mencatat **caranya dibuktikan**
dan **apa yang masih meleset**, supaya putaran berikutnya tidak mengulang
penyelidikan yang sama.

Semua komponen ditempel berdampingan dengan potongan framenya di
`/admin/kit`. Itu bukan hiasan: mencocokkan angka yang saya ekstrak sendiri
tidak membuktikan apa-apa kalau ekstraksinya yang salah, dan di sesi ini tiga
"cacat komponen" terbesar ternyata cacat di alat ukurnya.

## Empat alat, empat pertanyaan berbeda

| Alat | Menjawab |
| --- | --- |
| `selisih.mjs` | Kotaknya seukuran belum? |
| `warna.mjs` | Ada warna Figma yang tidak tergambar di kit? |
| `tumpuk.mjs` | Berapa persen pikselnya berbeda? |
| `petabeda.mjs` | Di SEBELAH MANA bedanya? |

Yang terakhir yang paling sering menyelamatkan. Tiga yang pertama cuma
melaporkan angka; yang menunjukkan bahwa relnya tidak pernah tergambar, atau
bahwa satu kata hilang, cuma gambar selisihnya.

## Aturan mengukur yang sudah terbukti

1. **Ukuran huruf diturunkan dari LEBAR tinta, tidak pernah dari tingginya.**
   Tinggi tinta bergantung pada ada-tidaknya ascender dan descender di string
   itu, dan `$` menjulur di atas cap. Judul halaman Coinest bertinggi tinta
   16,79 — terbaca persis seperti 18px, dan ternyata **22px**: "Dashboard"
   bertinta 106,84 lebar, dan 22/600 memberi 107,1 sementara 18/600 cuma 87.

2. **Ukur dengan string yang SAMA PERSIS.** Teksnya di frame sudah jadi
   outline, jadi tidak bisa disalin — tapi bisa DIBACA dengan merender
   potongan framenya besar-besar. Dari situ ketahuan Coinest menulis
   "Dashboard", "Audrey Murphy", "Healthcare", "#RetirementPlanning", dan
   seterusnya. Sebelum itu saya memakai "Page Title" dan "Category Name", dan
   seluruh selisihnya bercerita tentang kata yang berbeda, bukan tentang
   komponennya.

3. **Ukur di DOM, bukan cuma di canvas.** Keduanya sempat berbeda sepuluh
   piksel pada string yang sama, dan yang menentukan tentu yang tergambar.

4. **Garis Figma MENGANGKANGI tepi** — setengah di dalam, setengah di luar —
   sementara `border` CSS seluruhnya di dalam border-box. Yang harus sama
   batas LUARNYA, jadi kotak CSS-nya dibuat 1px lebih besar dan paddingnya
   dikurangi setebal garisnya. Ini yang membuat kartu transfer terbaca 299x67
   padahal framenya 300x68.

5. **Radius Figma dipanggang ke data path, dan corner smoothing membuat
   rentangnya ~1,8x radius tampaknya.** Gelembung chat tertulis merentang
   21,6 di sudutnya; radius sebenarnya **12**.

6. **Varian Mobile bukan komponen, melainkan MEDIA QUERY.** Mengukurnya di
   viewport 1400 selalu melaporkan varian desktopnya. `selisih.mjs` karena
   itu menerima lebar viewport sebagai argumen: `node selisih.mjs 390`.

## Palet ketiga

Frame Item memakai lima warna yang **tidak muncul di satu pun frame lain**.
Dihitung di lima belas frame: `#272932` sembilan kali di Item dan nol di dua
belas frame lainnya, `#8A8C90` empat, `#E1E1E2` lima, `#C2E66E` dua,
`#52545B` lima. Jadi ini bukan salah baca — keluarga baris daftar memang
punya paletnya sendiri, sama seperti Forms dan Calendar punya palet
beige-mintnya. Tokennya `--item-*` di `tokens.css`, dan berbeda dari palet
kedua ia **diturunkan untuk tema gelap**: `#272932` hampir sama gelapnya
dengan permukaan gelap panel, jadi membiarkannya apa adanya akan
menghilangkan nama pengirim sama sekali.

## Hasil pengukuran terakhir

98 pasangan diukur kotaknya, 104 diaudit warnanya, 98 diselisihkan
pikselnya.

| Ukuran | Hasil |
| --- | --- |
| Kotak sama persis | 79 dari 98 |
| Warna Figma yang tidak tergambar di kit | 7 komponen |
| Median selisih piksel | 3,40% |

### Yang masih meleset, dan kenapa

Semuanya sudah ditelusuri sampai sebabnya. Tidak ada yang "belum sempat
dilihat".

**Kotak (19 pasangan):**

- **Empat varian Mobile** (`Version=Mobile`, `Mobile_2`, `Mobile_4`,
  `Mobile_5`) meleset di viewport 1400 dan **sama persis di 390** — memang
  media query. Diukur dengan `node selisih.mjs 390`.
- **Empat blok teks berbaris banyak** (`Type=1`, `Type=Read`, `Variant=V2`,
  dan kaki halaman ponsel) meleset 1–4,5px. Figma mengukur TINTA; CSS
  mengukur KOTAK BARIS, dan kotak baris selalu sedikit lebih tinggi daripada
  tintanya. Selisihnya tetap ada berapa pun ukuran hurufnya disetel.
- **`Chips Tags` +3,0 dan `Active=False` +2,1** — lebar kata contohnya.
  "FinancialPlanning" di 12px menggambar 88,9 di sini dan 87,43 di Figma;
  selisih 1,5px itu milik pembulatan ukuran huruf ke nilai skala Coinest,
  bukan milik komponennya.
- Sisanya milik frame lain (Tabel +0,5 tinggi, Chart +1,5) dan sudah dicatat
  di putaran sebelumnya.

**Warna (7 komponen):**

- Tiga slot penampung yang memang sengaja kosong di kit: teks banner promo
  `#A3A3A3`, lambang logo studio `#1E4841`, logo keping kartu `#415C58`.
- `#FFD9CF` pada tiga baris pesan: Figma menumpuk DUA bidang di tempat
  avatar — lingkaran persik, lalu kotak "Place Image Here" mint yang
  menutupinya habis. Yang tergambar mint; persiknya tidak pernah terlihat.
  Audit membaca atribut, bukan piksel, jadi ia tetap melaporkannya.
- `#D2EBFF` dan `#E5E6E6` pada `Type=2`: warna ilustrasi mobil di lampiran
  gelembung chat. Kit menggambar kotak pengganti, bukan ilustrasinya.

**Piksel:** yang di atas 10% semuanya baris yang isinya hampir seluruhnya
teks. Pada baris seperti itu, geseran setengah piksel pada satu kata sudah
menyalakan seluruh tinggi huruf sebagai "berbeda". Yang perlu dipercaya di
sana peta selisihnya, bukan persentasenya.

### Satu bentrok yang belum bisa diselesaikan

`Item List Recent Activity` memakai ukuran huruf yang jatuh di **15,5px** —
diukur dua kali, dengan canvas dan dengan DOM, pada string yang sama persis.
Itu bukan nilai yang ada di skala Coinest (…12, 14, 16, 18…). Dipakai 16px
sebagai nilai skala terdekat, dan konsekuensinya baris teksnya membungkus
satu kata lebih awal daripada framenya. Kalau suatu saat ketahuan Coinest
memang memakai instance yang diskalakan, angkanya tinggal dikembalikan.

## Lima bentuk dari frame INTERFACE

Ditambahkan setelah P3, dan urutannya memang begitu: kelimanya baru
ketahuan kurang waktu kotak wireframe ditumpuk di atas gambar frame
halamannya. Tidak ada di satu pun frame Style & Component, jadi P2 tidak
mungkin membangunnya.

Hidup di `components/kit/Ukuran.tsx`:

| Komponen | Dari | Kotak | Selisih piksel |
| --- | --- | --- | --- |
| `BarKemajuan` terpisah | Saving Plans | 324x12 cocok | 0,14% |
| `BarKemajuan` di kartu | Dashboard v2 | 251x25 cocok | 0,05% |
| `BarKemajuan` tumpuk | Saving Plans | 252x51 cocok | 0,32% |
| `GrafikArea` halus | Dashboard v2 | 554,7x195,1 cocok | 14,4% ¹ |
| `GrafikArea` tangga | Investments | 553,7x226,5 cocok | 4,8% ¹ |
| `Busur` | Investments | 224x112 cocok | 7,5% |
| `KartuStatistikLebar` | Saving Plans | 386x88 cocok | 6,5% |

¹ Kurvanya digambar Figma DI LUAR layer `Chart`, jadi potongan acuannya cuma
memuat kisi dan label sumbu. Yang dibandingkan di situ geometri kisinya, dan
itu cocok sampai 0,04px. Selisih pikselnya seluruhnya milik kurva yang ada
di kit dan tidak ada di acuannya.

Tiga hal yang diukur dan gampang salah kira:

- **Bar kemajuan bukan rel dengan isian di atasnya.** Bentuk yang dipakai di
  tiga dari empat tempat adalah DUA kotak bersebelahan dengan celah 4px di
  antaranya. Menggambarnya sebagai rel penuh menghilangkan celah itu, dan
  celahnya terlihat di setiap baris daftar.
- **Busurnya setengah lingkaran berjari-jari 112 luar / 85 dalam**, celah
  antar-irisan **2 derajat**. Digambar sebagai path arc, bukan lingkaran
  ber-`stroke-dasharray`: dasharray menghitung celah dalam satuan panjang
  busur, jadi celah yang sama terlihat berbeda lebar pada irisan yang
  berbeda besar.
- **Isi lubang busurnya 51% tinggi, bukan 40%.** Sempat 40%, dan baris
  ketiganya ("+5% compared to last year") terpotong habis — tanpa galat,
  tanpa peringatan, barisnya sekadar tidak tergambar. Yang menemukannya peta
  selisih, bukan angka.

Alat auditnya ikut diperbaiki lagi: `warnaTergambar` dulu tidak membaca
`stroke` SVG sama sekali, jadi warna garis kurva dilaporkan "tidak ada di
kit" pada grafik yang sudah benar. Cacat yang sama persis dengan
`borderTopColor` sebelumnya — alat ukur yang buta pada satu properti akan
selalu menyalahkan komponen yang benar.

## Menjalankan ulang

```bash
cd apps/web && npm run build          # mock API harus hidup dulu
python3 -m http.server 4399           # sajikan dist; jangan http-server (jebakan #28)
node selisih.mjs 1400 && node selisih.mjs 390
node warna.mjs
node tumpuk.mjs
PILIH="Item / Type=2" node petabeda.mjs
```

Acuan Figma-nya digenerate: ubah daftar `PASANGAN` di
`scripts/buat-banding.py`, lalu jalankan skripnya. Jangan sunting
`components/kit/banding/figma.ts`.
