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

¹ **Catatan ini sebelumnya salah dan sudah dicabut.** Yang tertulis di sini
dulu: "kurvanya digambar Figma di luar layer `Chart`, jadi selisih pikselnya
milik kurva yang ada di kit dan tidak ada di acuannya". Itu tidak benar, dan
dipakai untuk memaafkan selisih 14,43%. Kurvanya ADA di dalam
`Chart > Chart Area` — `Line Income`, `Line Income Area`, `Line Expense`,
`Line Expense Area` — dan saya melewatkannya karena menyalurkan pencarian
lewat `head -16`. Datanya lalu dibaca dari titik ujung Bezier-nya dan
dipetakan balik lewat kisi; selisihnya sekarang 3,1%.

Tiga hal yang diukur dan gampang salah kira:

- **Bar kemajuan bukan rel dengan isian di atasnya.** Bentuk yang dipakai di
  tiga dari empat tempat adalah DUA kotak bersebelahan dengan celah 4px di
  antaranya. Menggambarnya sebagai rel penuh menghilangkan celah itu, dan
  celahnya terlihat di setiap baris daftar.
- **Busurnya setengah lingkaran berjari-jari 112 luar / 85 dalam**, celah
  antar-irisan **2 derajat** dan celah itu diambil dari UJUNG irisan saja,
  bukan dibagi dua sisi — membaginya menyempitkan tiap iris 2 derajat dan
  memutarnya 1 derajat. Digambar sebagai path arc, bukan lingkaran
  ber-`stroke-dasharray`: dasharray menghitung celah dalam satuan panjang
  busur, jadi celah yang sama terlihat berbeda lebar pada irisan yang
  berbeda besar.
- **Isi lubang busurnya 51% tinggi, bukan 40%.** Sempat 40%, dan baris
  ketiganya ("+5% compared to last year") terpotong habis — tanpa galat,
  tanpa peringatan, barisnya sekadar tidak tergambar. Yang menemukannya peta
  selisih, bukan angka.

## Audit ulang seluruh kit

Diminta pemilik: bukan cuma grafiknya, yang SEBELUMNYA juga. Hasilnya enam
cacat, dan tidak satu pun ketemu dari membaca kode — semuanya dari menumpuk
render di atas acuannya.

| Cacat | Besarnya |
| --- | --- |
| Chromium membulatkan lebar-maju tiap glif ke piksel bulat, Figma tidak | 4 tombol + 3 lencana meleset +-2px |
| Padding tombol diturunkan ulang dari letak tinta | 12 dari 12 lebar cocok, meleset terbesar 0,15px |
| Tab kategori tidak aktif berbobot 400, bukan 600 (dan labelnya "All", bukan "3D") | tab 1,2px kelebaran dan jelas ketebalan |
| Keping tagar: "#" dan labelnya satu baris menyambung, bukan dua kotak berjarak 1,76 | 2,95px kelebaran |
| Lampiran gambar di gelembung pesan ABU #E5E6E6, bukan mint | 33% selisih piksel jadi 3,7% |
| Teks baris aktivitas 12,5px, bukan 16 — dan ikonnya tampil 32, bukan 12 | teks 28% kebesaran, ikon 2,7x kekecilan |

Ditambah lima lagi yang lebih kecil, semuanya terukur:

- Bilah kepala seksi memakai tombol ukuran **Medium**, bukan small: tiap
  pemilih "Popular" 81x32 dan kedua tombol ikonnya 32x32 di framenya. Titik
  tiganya tergambar 22px, lebih besar daripada 16 yang dipakai ikon Medium
  lain. Jaraknya 10, bukan 11 — angka 11 diukur dari tepi `<rect>`, dan
  `<rect>` bergaris di Figma digambar masuk setengah piksel di tiap sisi.
- Kaki halaman: jarak tautan 16,55 dan legal 20,85 (jarak TINTA di framenya
  dikurangi bearing hurufnya), ikon sosial 24px berjarak 12 — jarak antar-
  pusat kelimanya di framenya persis 36,0.
- Baris beban varian Mobile MENAIKKAN ukuran hurufnya: 14/16/16, bukan
  menyalin 12/14/14 dari desktopnya.
- Radius kotak centang ikut ukuran (0,23 x sisi), bukan 4px tetap.
- Kartu keterangan grafik tangga DIPUSATKAN pada anak tangganya, sementara
  di grafik halus tepi kirinya duduk di garis penanda. Dua letak berbeda,
  dua-duanya terukur.

### Alatnya sendiri dua kali berbohong

- `petabeda.mjs` menumpuk dua gambar dari pojok kiri-atas. Ekspor Figma
  dipotong pada TINTA sementara kotak DOM memuat ruang baris di atas dan di
  bawah huruf, jadi baris pesan yang sebenarnya rapi terbaca 13,7%. Sekarang
  geseran tinta dicoba dan dipakai hanya kalau ia memperkecil selisihnya —
  dipaksakan, ia justru merusak pasangan yang piksel teratasnya bukan benda
  yang sama (frame Chart terbaca 48,7%).
- `baris.mjs` baru: pita tinta per baris piksel, acuan dan kit berdampingan.
  Itu yang menjawab "barisnya turun 2px"; selisih kotak tidak pernah bisa.

### Angka penutup

| Ukuran | Sebelum | Sesudah |
| --- | --- | --- |
| Selisih kotak meleset >1px (105 pasangan) | 24 | 12 |
| Rata-rata selisih piksel | — | 3,3% |
| Selisih piksel terburuk | 33,1% | 13,7% |

Dua belas yang tersisa **semuanya satu sebab yang sama**, dan itu bukan
cacat tata letak: bingkai Figma adalah kotak TINTA layernya, sementara kotak
DOM kita adalah kotak elemennya. Untuk tepi yang berupa teks selisihnya ruang
baris di bawah baris terakhir (lima label grafik +1,5; `Type=1` +1,0;
`Type=Read` +1,8; `Variant=V2` +1,2); untuk kaki halaman selisihnya kotak
ikon 24 lawan tintanya 19,5 (+4,5). Dua grafik besar +1,4/+1,5 adalah
pertukaran yang disengaja: yang diutamakan kisinya lurus, bukan tinggi
kotaknya.

Dibuktikan pada `Item / Variant=V2` — setelah jaraknya dibetulkan, pita
tintanya `0,50..30,33  35,33..45,83` di kedua sisi, sama persis, sementara
selisih kotaknya tetap melapor +1,2px. Artinya angka selisih-kotak untuk
komponen yang tepinya teks memang tidak bisa nol, dan mengejarnya sampai nol
justru akan memindahkan tinta hurufnya ke tempat yang salah.

**Varian Mobile di frame Item wajib diukur pada viewport 390** — ia media
query, bukan komponen tersendiri. Di 1400 keempatnya melapor meleset padahal
yang tergambar varian desktopnya.

## Putaran ketiga: ukuran huruf, tebal huruf, dan warna

Pemilik menunjuk lima gambar dan menyebut grafik yang kaku, warna yang
tidak sesuai, persentase yang kekecilan, dan ikon yang kekecilan. Sebagian
memang sudah diperbaiki di putaran sebelumnya dan tangkapan layarnya
mendahului perbaikan itu — tapi menjawab begitu saja tidak cukup, jadi
seluruh kit diukur ulang dari sisi yang memang belum pernah diukur:
**ukuran dan tebal huruf, dan PORSI tiap warna.**

### Alat baru: `teks.mjs`

Dua hal yang tidak bisa dijawab alat yang sudah ada:

- **Ukuran dan tebal huruf.** Keduanya mengubah lebar tinta satu baris dan
  tidak mengubah apa pun yang lain, jadi selisih KOTAK komponen tidak
  pernah menunjukkannya — kotaknya ditentukan wadahnya. Yang dibandingkan
  sekarang tiap pita tinta mendatar: lebar dan tingginya, acuan lawan kit.
- **Warna yang salah pada elemen yang benar.** `warna.mjs` membandingkan
  HIMPUNAN warna, jadi nominal yang seharusnya hijau tua tapi digambar
  hitam tidak ketahuan selama hijau tuanya masih dipakai di tempat lain
  dalam komponen yang sama. Yang dibandingkan sekarang porsinya.

Pendampingnya `cocokfont.mjs`: diberi lebar dan tinggi tinta Figma, ia
memindai Urbanist pada 8..34px dan lima bobot lalu melaporkan tiga
pasangan terdekat. Itu yang mengubah "ukuran fontnya kira-kira segini"
jadi angka.

### Yang ditemukan

| Cacat | Bukti |
| --- | --- |
| Nominal digambar HITAM, seharusnya hijau tua #1E4841 | porsi #1E4841 2,7% jadi 0,6%; #242E2C 0,7% jadi 2,2% |
| Nominal berbobot 600, seharusnya 700 | tinta "$500,000" 102,88x22,18; 24px/700 memberi 103,00x22,25 |
| Label busur abu, seharusnya #242E2C | fill layer Title_10 |
| Angka lencana tren tanpa bobot (mewarisi 400), seharusnya 600 | tinta "4.20 %" 27,89x7,26; 10px/600 memberi 27,88x7,25 |
| Label sumbu grafik abu, seharusnya #242E2C | fill Y-label dan X-label di ketiga frame grafik |
| Tinta baris nav yang AKTIF hijau tua, seharusnya #242E2C | porsi #242E2C 5,5% jadi 0% |
| Garis grafik bersiku tajam, seharusnya membulat | `stroke-linecap="round" stroke-linejoin="round"` di kelima layer garis |
| Pita sorot grafik tangga selebar penuh dan tanpa garis | di framenya 40 pada tangga 52, bergaris #ECF4E9 2px |
| Pita sorot TIDAK PERNAH TERGAMBAR setelah diperbaiki | lebarnya dalam persen terhadap kotak selebar nol = nol |
| Pemilih di bilah kepala seksi mint, seharusnya putih bergaris | porsi mint 15,6% jadi 52,3% |
| Judul baris tabel berbobot 400, seharusnya 600 (500 di Transaction) | tinta 120,92 / 41,69 / 113,54 |
| Kolom Note dan tiga kolom nominal Investment hitam, seharusnya abu | fill #6B7271 di layer teksnya |
| Cuplikan pesan yang sedang dibuka terlalu terang | #555555 lawan #8C8D8C, 15,2% tinta barisnya |
| Isian Large berisi placeholder abu, di framenya nilai hitam | fill Label_5 #242E2C, sementara kotak cari Medium memang #6B7271 |
| Avatar baris pesan menempel ke atas, seharusnya dipusatkan | 2,5 dari puncak baris di framenya |

### Empat kali alat ukurnya sendiri yang salah

Dicatat karena tiap kali ia membuat saya mengejar cacat yang tidak ada:

1. **Menumpuk dari pojok, bukan dari tinta.** Sudah diperbaiki putaran lalu.
2. **Memaksakan geseran tinta.** Pada frame Chart piksel teratas di kedua
   gambar bukan benda yang sama, dan geserannya memindahkan gambar 73px.
   Sekarang geserannya dicoba dan dipakai hanya kalau memperkecil selisih.
3. **Mengukur pasangan yang acuannya TANPA KOTAK.** Di situ selnya lebih
   kecil daripada elemen kit dan isinya meluber keluar; "Wed" terbaca
   setinggi setengahnya dan nav tidak aktif 33% lebih sempit. Sekarang
   dilewati.
4. **Membandingkan warna sama-persis, dan mengukur porsinya terhadap
   SELURUH sel.** #EEEEEF lawan #EFF0F0 terbaca "hilang" padahal selisihnya
   1/255, dan sparkline tren terbaca 25,4% lawan 40,9% padahal nilai
   pikselnya sama persis baris demi baris. Sekarang warna dicocokkan dengan
   toleransi 12, yang berdekatan digabung dulu, dan latar putihnya dibuang
   sebelum porsinya dihitung.

### Angka penutup putaran ini

| Ukuran | Sebelum putaran ini | Sesudah |
| --- | --- | --- |
| Rata-rata selisih piksel 105 pasangan | 3,3% | **3,2%** |
| Selisih piksel terburuk | 13,7% | **9,9%** |
| Porsi warna meleset | 37 | **14** |

Empat belas sisa warnanya: logo Coinest yang memang tidak ditiru, sparkline
tren yang selnya beda ukuran (sudah dibuktikan pikselnya identik), dan
antialias ikon 24px di kaki halaman.

## Menjalankan ulang

```bash
cd apps/web && npm run build          # mock API harus hidup dulu
python3 -m http.server 4399           # sajikan dist; jangan http-server (jebakan #28)
node selisih.mjs 1400 && node selisih.mjs 390
node warna.mjs
node tumpuk.mjs
PILIH="Item / Type=2" node petabeda.mjs
LEBAR=390 PILIH="Mobile" node petabeda.mjs    # varian Mobile WAJIB di 390
PILIH="Item / Variant=V2" node baris.mjs      # pita tinta per baris
```

Acuan Figma-nya digenerate: ubah daftar `PASANGAN` di
`scripts/buat-banding.py`, lalu jalankan skripnya. Jangan sunting
`components/kit/banding/figma.ts`.
