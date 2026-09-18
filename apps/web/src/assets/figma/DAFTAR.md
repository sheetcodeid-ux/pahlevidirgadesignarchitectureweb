# Aset asli dari Figma — Coinest

Semua berkas di bawah `assets/figma/` **diekspor sendiri oleh pemilik dari
Figma**, bukan hasil tracing dan bukan hasil unduhan otomatis. Keduanya tidak
mungkin:

- Menggambar ulang dari tangkapan layar = menjiplak, tidak akan pernah persis.
- Mengunduh lewat connector = URL asetnya di `www.figma.com`, dan gateway
  jaringan sesi Claude menolak host itu (kebijakan organisasi). Terukur:
  `http:000`, `connect_rejected`. Tidak ada setelan Figma yang mengubahnya.

Jadi folder ini **satu-satunya sumber kebenaran bentuk**. Jangan menggantinya
dengan bentuk karangan, dan jangan menyuntingnya "supaya rapi" — kalau ada
yang salah, yang diperbaiki ekspornya di Figma.

## Isi

| Folder | Isi |
| --- | --- |
| `style/` | 15 frame halaman 🎨 Style & Component, utuh apa adanya |
| `interface/` | 13 frame halaman 💻 Interface, desktop |
| `ikon/` | 179 ikon, hasil ekstraksi dari `style/` |

## Setelan ekspor yang dipakai

| Opsi Figma | Nilai |
| --- | --- |
| Format | **SVG** |
| Suffix | kosong |
| Color profile | **sRGB** |
| Ignore overlapping layers | nyala |
| Include bounding box | nyala |
| Include "id" attribute | **nyala** — ini yang membuat ekstraksi ikon mungkin |
| Outline text | nyala |

`Include "id" attribute` bukan pilihan bebas: tanpa itu nama layer Figma tidak
ikut ke dalam SVG, dan 179 ikon di bawah ini tidak akan bisa dipisahkan dari
frame-nya sama sekali.

## Cara ikon diekstrak

Skrip pemisahnya (`scripts/ekstrak-ikon-figma.py`) mengambil tiap grup
`<g id="Icon/...">` dari frame utuh, lalu menuliskannya sebagai SVG tersendiri.
**Koordinat path tidak disentuh sama sekali** — yang disetel hanya `viewBox`-nya,
dipusatkan pada titik tengah gambar dengan sisi **32**. Menulis ulang koordinat
berarti memperkenalkan pembulatan; menggeser viewBox tidak.

### Sisi bingkainya 32, bukan 24

Ini sudah salah sekali dan memotong **145 dari 179 ikon**. Angka 24 datang dari
kode acuan Figma, yang menuliskan `size-[24px]` — tapi itu ukuran **tampil**
sebuah instance di halaman, bukan ukuran masternya.

Dibuktikan dua cara, keduanya dari berkasnya sendiri:

1. Kisi ikon di frame `Element` berjarak **48px pusat ke pusat**. Bingkai 32
   menyisakan celah 16px; bingkai 24 menyisakan 24px sementara ada gambar
   selebar 32 yang berarti menabrak tetangganya.
2. Gambar terlebar terukur **32,01px** — persis sisi bingkainya.

Tanda khasnya: dengan sisi 24, luberannya **simetris persis 4,00px di kiri dan
4,00px di kanan**. Luberan simetris berarti bingkainya kekecilan, bukan
viewBox-nya yang meleset — kalau pusatnya yang salah, luberannya berat sebelah.

Dua ikon punya gambar sedikit melebihi 32 (`ConversionRate` 32,00 dan
`UserSwitch` 32,01), jadi viewBox-nya dilebarkan seperlunya. Atribut
`width`/`height`-nya tetap ditulis **32 bulat**: kalau ikut ditulis `32.0005`,
selektor `svg[width][height]` penjaga jebakan #7 tetap cocok tapi ikonnya jadi
satu-satunya yang ukurannya ganjil — dan di lembar uji ia tampil separuh
ukuran tetangganya. Bedanya 0,0016% dan tidak bisa dilihat.

### Dua cacat lain yang sudah ditutup

1. **Nama ikon yang sama muncul di beberapa frame.** `Icon/CaretDown` ada di
   `Element.svg` (ukuran master) DAN di `Button.svg` (instance 14px di dalam
   tombol). Urutan abjad membuat Button menang, dan hasilnya caret mungil di
   tengah bingkai; CalendarBlank bahkan nyaris kosong. Sekarang `Element.svg`
   didahulukan, lalu yang gambarnya paling besar yang dipakai.
2. **Grup WADAH ikut tertangkap.** `Icon/Navs`, `Icon/System`, dan `Icon/Room`
   adalah kisi berisi puluhan ikon, lebarnya ratusan piksel. Disaring dengan
   ambang 40px — ikon tunggal terbesar 32px, jadi ambangnya aman.

### Cara memverifikasinya, dan cara yang TIDAK bekerja

Dua-duanya wajib, dan urutannya penting:

1. **Hitung kotak gambar sesungguhnya** lewat titik ekstrem kurva
   (`scripts/bbox-svg.py`), lalu pastikan ia muat di dalam viewBox. Hull titik
   kendali TIDAK boleh dipakai: ia selalu lebih besar dari gambarnya, jadi
   luberan sungguhan terbaca sebagai "overshoot Bézier yang wajar". Itu persis
   yang membuat 145 ikon terpotong lolos.
2. **Render seluruhnya berdampingan pada ukuran BESAR** (96px), lalu lihat.
   Lembar uji sebelumnya memakai 24px dan lolos — pada ukuran sekecil itu
   tumpukan koin yang terpotong masih terbaca seperti tumpukan koin. Pemilik
   menangkapnya dengan memperbesar di ponsel.

Penghitung "0 ikon bermasalah" yang hanya melihat jumlah path, atau mata yang
hanya melihat ikon pada ukuran pakai, tidak menangkap satu pun dari ketiga
cacat di atas.

## Cara ikon masuk ke kode

Berkas mentah disimpan apa adanya di `ikon/`, lalu dijadikan komponen di
`apps/web/src/components/ui/Icon.tsx`. Warna tinta Coinest (`#242E2C`,
`#1E4841`, `#6B7271`) sudah diganti `currentColor` saat ekstraksi, supaya ikon
ikut warna teks di sekitarnya. Warna lain dibiarkan — itu lambang berwarna,
bukan ikon.

Jebakan #7 di CLAUDE.md tetap berlaku: `svg[width][height]` butuh
`flex: none; max-width: none;` supaya tidak menyusut jadi 0x0 di kolom sempit.

## Yang BELUM ada

- **`01. Dashboard (v1) - Desktop`** tidak ikut di ZIP Interface — yang masuk
  13 frame, mulai dari `04. Dashboard (v2)`. Frame itu justru yang paling
  banyak dipakai sejauh ini; spesifikasinya sementara masih dari panggilan
  MCP yang tercatat di CLAUDE.md.
- **Varian Tablet dan Mobile** tidak ikut. Responsifnya karena itu belum punya
  acuan; jangan dikarang, minta ekspornya.

## 15 item halaman 🎨 Style & Component

| # | Item | Sudah dibangun? |
| --- | --- | --- |
| 1 | `Badges` | belum |
| 2 | `Breadcrumb` | belum |
| 3 | `Button` | belum |
| 4 | `Calendar` | belum |
| 5 | `Card` | belum |
| 6 | `Chart` | belum |
| 7 | `Color` | belum |
| 8 | `Element` | belum |
| 9 | `Forms` | belum |
| 10 | `Frame 1` | belum |
| 11 | `Item` | belum |
| 12 | `Nav` | belum |
| 13 | `Pagination` | belum |
| 14 | `Table` | belum |
| 15 | `Typography` | belum |

## 13 frame halaman 💻 Interface

| # | Frame |
| --- | --- |
| 1 | `04. Dashboard (v2) - Desktop` |
| 2 | `07. Transfer - Desktop` |
| 3 | `10. Payment - Desktop` |
| 4 | `13. Transactions - Desktop` |
| 5 | `16. Invoices - Desktop` |
| 6 | `19. Cards - Desktop` |
| 7 | `22. Saving Plans - Desktop` |
| 8 | `25. Investments - Desktop` |
| 9 | `28. Inbox - Desktop` |
| 10 | `31. Promos - Desktop` |
| 11 | `34. Promo Details - Desktop` |
| 12 | `37. Insights - Desktop` |
| 13 | `40. Insight Details - Desktop` |

## 179 ikon

Kolom "nama Figma" diambil dari atribut `id` di dalam berkas sumbernya, bukan
dari nama berkas — nama berkas bisa berubah, `id` tidak.

| Berkas | Nama Figma | viewBox | Frame asal |
| --- | --- | --- | --- |
| `ArchiveTray` | `Icon/ArchiveTray` | `192 1081 32 32` | Element |
| `ArrowClockwise` | `Icon/ArrowClockwise` | `961 1081 32 32` | Element |
| `ArrowDown` | `Icon/ArrowDown` | `768 1033 32 32` | Element |
| `ArrowLeft` | `Icon/ArrowLeft` | `576 985.001 32 32` | Element |
| `ArrowRight` | `Icon/ArrowRight` | `624 985.001 32 32` | Element |
| `ArrowUp` | `Icon/ArrowUp` | `720 1033 32 32` | Element |
| `ArrowsLeftRight` | `Icon/ArrowsLeftRight` | `624 1081 32 32` | Element |
| `Bell` | `Icon/Bell` | `576 1033.5 32 32` | Element |
| `BookmarkSimple` | `Icon/BookmarkSimple` | `384 1081.5 32 32` | Element |
| `Briefcase` | `Icon/Briefcase` | `96 1081 32 32` | Element |
| `CalendarBlank` | `Icon/CalendarBlank` | `96 1032 32 32` | Element |
| `CaretDown` | `Icon/CaretDown` | `624 1034 32 32` | Element |
| `CaretLeft` | `Icon/CaretLeft` | `719 985.001 32 32` | Element |
| `CaretRight` | `Icon/CaretRight` | `673 985.001 32 32` | Element |
| `CaretUp` | `Icon/CaretUp` | `672 1032 32 32` | Element |
| `ChalkboardTeacher` | `Icon/ChalkboardTeacher` | `480 985 32 32` | Element |
| `ChartBar` | `Icon/ChartBar` | `1296 1032.5 32 32` | Element |
| `ChatTeardropDots` | `Icon/ChatTeardropDots` | `384.5 1032.5 32 32` | Element |
| `Check` | `Icon/Check` | `240.5 1081 32 32` | Element |
| `CheckCircle` | `Icon/CheckCircle` | `1296 1081 32 32` | Element |
| `CircleDashed` | `Icon/CircleDashed` | `1248 1081 32 32` | Element |
| `CircleWavyCheck` | `Icon/CircleWavyCheck` | `144 1033 32 32` | Element |
| `Clock` | `Icon/Clock` | `336 984.999 32 32` | Element |
| `CoinIn` | `Icon/CoinIn` | `144 985 32 32` | Element |
| `CoinOut` | `Icon/CoinOut` | `96 985 32 32` | Element |
| `CoinVertical` | `Icon/CoinVertical` | `384 1129 32 32` | Element |
| `ConversionRate` | `Icon/ConversionRate` | `960 984.999 32.0005 32.0005` | Element |
| `CopySimple` | `Icon/CopySimple` | `672 1081 32 32` | Element |
| `CornersOut` | `Icon/CornersOut` | `864 1081 32 32` | Element |
| `CurrencyCircleDollar` | `Icon/CurrencyCircleDollar` | `336 1033 32 32` | Element |
| `CursorClick` | `Icon/CursorClick` | `910.5 983.5 32 32` | Element |
| `DotsThree` | `Icon/DotsThree` | `1056 985 32 32` | Element |
| `DotsThreeVertical` | `Icon/DotsThreeVertical` | `1104 985 32 32` | Element |
| `DownloadSimple` | `Icon/DownloadSimple` | `336 1081 32 32` | Element |
| `EnvelopeOpen` | `Icon/EnvelopeOpen` | `192 1032 32 32` | Element |
| `Eye` | `Icon/Eye` | `816 985 32 32` | Element |
| `FacebookLogo` | `Icon/FacebookLogo` | `816 1129 32 32` | Element |
| `FadersHorizontal` | `Icon/FadersHorizontal` | `480 1081 32 32` | Element |
| `FilePdf` | `Icon/FilePdf` | `1008.5 1032.5 32 32` | Element |
| `FileText` | `Icon/FileText` | `960 1033 32 32` | Element |
| `FileX` | `Icon/FileX` | `528 1033 32 32` | Element |
| `FileXls` | `Icon/FileXls` | `767.987 1128 32 32` | Element |
| `Funnel` | `Icon/Funnel` | `1200 986.065 32 32` | Element |
| `GearSix` | `Icon/GearSix` | `528 985 32 32` | Element |
| `Globe` | `Icon/Globe` | `624 1129 32 32` | Element |
| `GoogleDocsLogo` | `Icon/GoogleDocsLogo` | `960 1129 32 32` | Element |
| `GoogleDriveLogo` | `Icon/GoogleDriveLogo` | `1152 1128 32 32` | Element |
| `GpsFix` | `Icon/GpsFix` | `816 1081 32 32` | Element |
| `GridFour` | `Icon/GridFour` | `1152 1081 32 32` | Element |
| `Headset` | `Icon/Headset` | `1104 1130 32 32` | Element |
| `Hourglass` | `Icon/Hourglass` | `912 1081 32 32` | Element |
| `HourglassHigh` | `Icon/HourglassHigh` | `336 1129 32 32` | Element |
| `House` | `Icon/House` | `144 1128.5 32 32` | Element |
| `IdentificationBadge` | `Icon/IdentificationBadge` | `720 1081 32 32` | Element |
| `ImageSquare` | `Icon/ImageSquare` | `1152 1033 32 32` | Element |
| `Info` | `Icon/Info` | `1104 1033 32 32` | Element |
| `InstagramLogo` | `Icon/InstagramLogo` | `672 1129 32 32` | Element |
| `Link` | `Icon/Link` | `1056 1033 32 32` | Element |
| `LinkedinLogo` | `Icon/LinkedinLogo` | `912 1129 32 32` | Element |
| `List` | `Icon/List` | `1104 1081 32 32` | Element |
| `MagnifyingGlass` | `Icon/MagnifyingGlass` | `768 985.001 32 32` | Element |
| `MapPinArea` | `Icon/MapPinArea` | `1008 1080.5 32 32` | Element |
| `Medal` | `Icon/Medal` | `528 1081 32 32` | Element |
| `Minus` | `Icon/Minus` | `768 1081 32 32` | Element |
| `Nav-ArrowsLeftRight` | `Icon/Nav/ArrowsLeftRight` | `288 571 32 32` | Element |
| `Nav-CalendarDots` | `Icon/Nav/CalendarDots` | `144 570 32 32` | Element |
| `Nav-Cardholder` | `Icon/Nav/Cardholder` | `480 571 32 32` | Element |
| `Nav-Coins` | `Icon/Nav/Coins` | `432 571 32 32` | Element |
| `Nav-CreditCard` | `Icon/Nav/CreditCard` | `240 571 32 32` | Element |
| `Nav-CurrencyCircleDollar` | `Icon/Nav/CurrencyCircleDollar` | `384 571 32 32` | Element |
| `Nav-CurrencyEth` | `Icon/Nav/CurrencyEth` | `528 571 32 32` | Element |
| `Nav-Envelope` | `Icon/Nav/Envelope` | `576 571 32 32` | Element |
| `Nav-Newspaper` | `Icon/Nav/Newspaper` | `671 571 32 32` | Element |
| `Nav-PersonSimpleTaiChi` | `Icon/Nav/PersonSimpleTaiChi` | `1024 887.502 32 32` | Item |
| `Nav-Receipt` | `Icon/Nav/Receipt` | `336 571 32 32` | Element |
| `Nav-SealPercent` | `Icon/Nav/SealPercent` | `624 571 32 32` | Element |
| `Nav-SignOut` | `Icon/Nav/SignOut` | `192 571 32 32` | Element |
| `Nav-SquaresFour` | `Icon/Nav/SquaresFour` | `96 571 32 32` | Element |
| `Note` | `Icon/Note` | `576 1129 32 32` | Element |
| `NotePencil` | `Icon/NotePencil` | `288.5 1080.5 32 32` | Element |
| `PaperPlaneRight` | `Icon/PaperPlaneRight` | `816.397 1033 32 32` | Element |
| `Paperclip` | `Icon/Paperclip` | `863.434 1033.06 32 32` | Element |
| `Phone` | `Icon/Phone` | `240.479 1032.53 32 32` | Element |
| `Plus` | `Icon/Plus` | `1248 985 32 32` | Element |
| `PlusSquare` | `Icon/PlusSquare` | `288 985 32 32` | Element |
| `Question` | `Icon/Question` | `432 984.999 32 32` | Element |
| `Ruler` | `Icon/Ruler` | `528 1129 32 32` | Element |
| `SealPercent` | `Icon/SealPercent` | `480 1129 32 32` | Element |
| `ShareNetwork` | `Icon/ShareNetwork` | `430.999 1129 32 32` | Element |
| `ShoppingCart` | `Icon/ShoppingCart` | `382.5 984.5 32 32` | Element |
| `SidebarSimple` | `Icon/SidebarSimple` | `240 1129 32 32` | Element |
| `SignIn` | `Icon/SignIn` | `286 1033 32 32` | Element |
| `Sliders` | `Icon/Sliders` | `432 1081 32 32` | Element |
| `SmileySticker` | `Icon/SmileySticker` | `912 1033 32 32` | Element |
| `Sort` | `Icon/Sort` | `1008 985.001 32 32` | Element |
| `Special-AirplaneTilt` | `Icon/Special/AirplaneTilt` | `863.49 730.498 32 32` | Element |
| `Special-AmazonLogo` | `Icon/Special/AmazonLogo` | `97.0001 730.499 32 32` | Element |
| `Special-AppleLogo` | `Icon/Special/AppleLogo` | `142.998 728 32 32` | Element |
| `Special-Armchair` | `Icon/Special/Armchair` | `528 729.5 32 32` | Element |
| `Special-Bank` | `Icon/Special/Bank` | `624 729 32 32` | Element |
| `Special-Barbell` | `Icon/Special/Barbell` | `624 826 32 32` | Element |
| `Special-Bed` | `Icon/Special/Bed` | `385 778 32 32` | Element |
| `Special-Bread` | `Icon/Special/Bread` | `527.501 778 32 32` | Element |
| `Special-CalendarCheck` | `Icon/Special/CalendarCheck` | `912 729 32 32` | Element |
| `Special-CalendarSlash` | `Icon/Special/CalendarSlash` | `1296 729 32 32` | Element |
| `Special-Car` | `Icon/Special/Car` | `480 729.5 32 32` | Element |
| `Special-CaretDoubleUp` | `Icon/Special/CaretDoubleUp` | `1248 729 32 32` | Element |
| `Special-CheckSquare` | `Icon/Special/CheckSquare` | `960 778 32 32` | Element |
| `Special-CookingPot` | `Icon/Special/CookingPot` | `720 776 32 32` | Element |
| `Special-Cube` | `Icon/Special/Cube` | `480 825.998 32 32` | Element |
| `Special-CurrencyCircleDollar` | `Icon/Special/CurrencyCircleDollar` | `960 730 32 32` | Element |
| `Special-Dress` | `Icon/Special/Dress` | `1008 776.5 32 32` | Element |
| `Special-Drop` | `Icon/Special/Drop` | `624 777 32 32` | Element |
| `Special-DropHalfBottom` | `Icon/Special/DropHalfBottom` | `528 825 32 32` | Element |
| `Special-FaceMask` | `Icon/Special/FaceMask` | `1008 729.497 32 32` | Element |
| `Special-Fire` | `Icon/Special/Fire` | `240 777.5 32 32` | Element |
| `Special-FirstAid` | `Icon/Special/FirstAid` | `576 730 32 32` | Element |
| `Special-Fish` | `Icon/Special/Fish` | `574.497 779.5 32 32` | Element |
| `Special-Footprints` | `Icon/Special/Footprints` | `288 778.002 32 32` | Element |
| `Special-ForkKnife` | `Icon/Special/ForkKnife` | `671.5 778.492 32 32` | Element |
| `Special-GoogleLogo` | `Icon/Special/GoogleLogo` | `192 729.999 32 32` | Element |
| `Special-GraduationCap` | `Icon/Special/GraduationCap` | `384 731 32 32` | Element |
| `Special-Handbag` | `Icon/Special/Handbag` | `1200 776.5 32 32` | Element |
| `Special-Handshake` | `Icon/Special/Handshake` | `143.999 827 32 32` | Element |
| `Special-HouseLine` | `Icon/Special/HouseLine` | `816 729.675 32 32` | Element |
| `Special-Invoice` | `Icon/Special/Invoice` | `911.5 777.5 32 32` | Element |
| `Special-Knife` | `Icon/Special/Knife` | `767.999 777.5 32 32` | Element |
| `Special-Leaf` | `Icon/Special/Leaf` | `95.9998 826.001 32 32` | Element |
| `Special-Lightning` | `Icon/Special/Lightning` | `191.997 826 32 32` | Element |
| `Special-ListNumbers` | `Icon/Special/ListNumbers` | `815.988 777.5 32 32` | Element |
| `Special-Monitor` | `Icon/Special/Monitor` | `432 729 32 32` | Element |
| `Special-MoonStars` | `Icon/Special/MoonStars` | `337.004 777.497 32 32` | Element |
| `Special-Path` | `Icon/Special/Path` | `431.999 779.5 32 32` | Element |
| `Special-PersonArmsSpread` | `Icon/Special/PersonArmsSpread` | `480.002 777.535 32 32` | Element |
| `Special-PersonSimple` | `Icon/Special/PersonSimple` | `863.996 777.504 32 32` | Element |
| `Special-PersonSimpleBike` | `Icon/Special/PersonSimpleBike` | `240 825 32 32` | Element |
| `Special-PersonSimpleDeadlifts` | `Icon/Special/PersonSimpleDeadlifts` | `336 826 32 32` | Element |
| `Special-PersonSimpleRun` | `Icon/Special/PersonSimpleRun` | `383.504 826.5 32 32` | Element |
| `Special-PersonSimpleTaiChi` | `Icon/Special/PersonSimpleTaiChi` | `288 825.003 32 32` | Element |
| `Special-PintGlass` | `Icon/Special/PintGlass` | `432 826.5 32 32` | Element |
| `Special-ReceiptX` | `Icon/Special/ReceiptX` | `1104 730 32 32` | Element |
| `Special-Repeat` | `Icon/Special/Repeat` | `1200 730 32 32` | Element |
| `Special-RocketLaunch` | `Icon/Special/RocketLaunch` | `1295.5 778.497 32 32` | Element |
| `Special-SealCheck` | `Icon/Special/SealCheck` | `1152 730 32 32` | Element |
| `Special-ShoppingCart` | `Icon/Special/ShoppingCart` | `671.501 729.501 32 32` | Element |
| `Special-Sneaker` | `Icon/Special/Sneaker` | `1153.5 777.001 32 32` | Element |
| `Special-Speedometer` | `Icon/Special/Speedometer` | `191.997 776.997 32 32` | Element |
| `Special-SpotifyLogo` | `Icon/Special/SpotifyLogo` | `288 730 32 32` | Element |
| `Special-Suitcase` | `Icon/Special/Suitcase` | `144 777 32 32` | Element |
| `Special-TShirt` | `Icon/Special/TShirt` | `1056 778 32 32` | Element |
| `Special-Ticket` | `Icon/Special/Ticket` | `96 778 32 32` | Element |
| `Special-Umbrella` | `Icon/Special/Umbrella` | `720.003 729.998 32 32` | Element |
| `Special-UserCirclePlus` | `Icon/Special/UserCirclePlus` | `1056 730 32 32` | Element |
| `Special-Warehouse` | `Icon/Special/Warehouse` | `1248.01 776.997 32 32` | Element |
| `Special-Warning` | `Icon/Special/Warning` | `768 729.5 32 32` | Element |
| `Special-Watch` | `Icon/Special/Watch` | `1104 778 32 32` | Element |
| `Special-WindowsLogo` | `Icon/Special/WindowsLogo` | `239 730 32 32` | Element |
| `Special-Wrench` | `Icon/Special/Wrench` | `575.999 826.001 32 32` | Element |
| `Special-XLogo` | `Icon/Special/XLogo` | `335.996 730.008 32 32` | Element |
| `SpinnerGap` | `Icon/SpinnerGap` | `192 1129 32 32` | Element |
| `ThumbsUp` | `Icon/ThumbsUp` | `864.001 983.5 32 32` | Element |
| `Timer` | `Icon/Timer` | `1200 1080 32 32` | Element |
| `Trash` | `Icon/Trash` | `96 1128 32 32` | Element |
| `TrendDown` | `Icon/TrendDown` | `1296 985.001 32 32` | Element |
| `TrendUp` | `Icon/TrendUp` | `1152 985.001 32 32` | Element |
| `TwitterLogo` | `Icon/TwitterLogo` | `864 1129 32 32` | Element |
| `UserCircle` | `Icon/UserCircle` | `1200 1033 32 32` | Element |
| `UserCircleCheck` | `Icon/UserCircleCheck` | `1056.51 1080.99 32 32` | Element |
| `UserSwitch` | `Icon/UserSwitch` | `1248 1033 32.005 32.005` | Element |
| `Users` | `Icon/Users` | `575.996 1081.01 32 32` | Element |
| `VideoCamera` | `Icon/VideoCamera` | `289 1129 32 32` | Element |
| `VirtualAccount` | `Icon/VirtualAccount` | `240 985.001 32 32` | Element |
| `Wallet` | `Icon/Wallet` | `192.5 985 32 32` | Element |
| `WarningOctagon` | `Icon/WarningOctagon` | `480 1033 32 32` | Element |
| `WechatLogo` | `Icon/WechatLogo` | `1200 1129.03 32 32` | Element |
| `X` | `Icon/X` | `432 1033 32 32` | Element |
| `XLogo` | `Icon/XLogo` | `1008 1129.01 32 32` | Element |
| `YoutubeLogo` | `Icon/YoutubeLogo` | `720 1129 32 32` | Element |
| `ZoomLogo` | `Icon/ZoomLogo` | `1056 1129 32 32` | Element |
