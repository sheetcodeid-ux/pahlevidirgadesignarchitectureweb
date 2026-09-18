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

Skrip pemisahnya mengambil tiap grup `<g id="Icon/...">` dari frame utuh, lalu
menuliskannya sebagai SVG tersendiri. **Koordinat path tidak disentuh sama
sekali** — yang disetel hanya `viewBox`-nya, dipusatkan pada titik tengah
gambar dengan sisi 24. Menulis ulang koordinat berarti memperkenalkan
pembulatan; menggeser viewBox tidak.

Angka 24 bukan tebakan: ikon nav di frame Element berjarak **48px pusat ke
pusat** dengan sumbu tegak yang sama persis, jadi tiap ikon duduk di bingkai
24x24 dengan celah 24px.

Dua hal yang sudah menggigit sekali dan sudah ditutup:

1. **Nama ikon yang sama muncul di beberapa frame.** `Icon/CaretDown` ada di
   `Element.svg` (ukuran master 24px) DAN di `Button.svg` (instance 14px di
   dalam tombol). Urutan abjad membuat Button menang, dan hasilnya caret 14px
   di tengah bingkai 24 — tergambar mungil, dan CalendarBlank bahkan nyaris
   kosong. Sekarang `Element.svg` didahulukan, lalu yang gambarnya paling
   besar yang dipakai.
2. **Grup WADAH ikut tertangkap.** `Icon/Navs`, `Icon/System`, dan `Icon/Room`
   adalah kisi berisi puluhan ikon, lebarnya ratusan piksel. Disaring dengan
   ambang 40px — ikon tunggal terbesar terukur 30px, jadi ambangnya aman.

Verifikasinya **dengan melihat**, bukan dengan menghitung: seluruh 179 ikon
dirender berdampingan pada 24px lalu diperiksa satu layar. Itu yang menangkap
kedua cacat di atas; penghitung "0 ikon bermasalah" tidak menangkap satu pun,
karena keduanya memang tergambar — hanya salah ukuran.

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
| `ArchiveTray` | `Icon/ArchiveTray` | `196 1085 24 24` | Element |
| `ArrowClockwise` | `Icon/ArrowClockwise` | `1252.93 1132.93 24 24` | Element |
| `ArrowDown` | `Icon/ArrowDown` | `772 1037.05 24 24` | Element |
| `ArrowLeft` | `Icon/ArrowLeft` | `579.951 989.001 24 24` | Element |
| `ArrowRight` | `Icon/ArrowRight` | `628.049 989.001 24 24` | Element |
| `ArrowUp` | `Icon/ArrowUp` | `724 1036.95 24 24` | Element |
| `ArrowsLeftRight` | `Icon/ArrowsLeftRight` | `628 1085 24 24` | Element |
| `Bell` | `Icon/Bell` | `580 1037.49 24 24` | Element |
| `BookmarkSimple` | `Icon/BookmarkSimple` | `388 1085.53 24 24` | Element |
| `Briefcase` | `Icon/Briefcase` | `99.9999 1085 24 24` | Element |
| `CalendarBlank` | `Icon/CalendarBlank` | `100 1036 24 24` | Element |
| `CaretDown` | `Icon/CaretDown` | `628 1038 24 24` | Element |
| `CaretLeft` | `Icon/CaretLeft` | `723 989.001 24 24` | Element |
| `CaretRight` | `Icon/CaretRight` | `677 989.001 24 24` | Element |
| `CaretUp` | `Icon/CaretUp` | `676 1036 24 24` | Element |
| `ChalkboardTeacher` | `Icon/ChalkboardTeacher` | `484 989 24 24` | Element |
| `ChartBar` | `Icon/ChartBar` | `1300 1036.5 24 24` | Element |
| `ChatTeardropDots` | `Icon/ChatTeardropDots` | `388.499 1036.5 24 24` | Element |
| `Check` | `Icon/Check` | `244.5 1085 24 24` | Element |
| `CheckCircle` | `Icon/CheckCircle` | `1299.88 1085.12 24 24` | Element |
| `CircleDashed` | `Icon/CircleDashed` | `1251.99 1085 24 24` | Element |
| `CircleWavyCheck` | `Icon/CircleWavyCheck` | `148 1037 24 24` | Element |
| `Clock` | `Icon/Clock` | `339.874 989.125 24 24` | Element |
| `CoinIn` | `Icon/CoinIn` | `147.951 988.951 24 24` | Element |
| `CoinOut` | `Icon/CoinOut` | `100 989 24 24` | Element |
| `CoinVertical` | `Icon/CoinVertical` | `388 1133 24 24` | Element |
| `ConversionRate` | `Icon/ConversionRate` | `964 988.999 24 24` | Element |
| `CopySimple` | `Icon/CopySimple` | `676 1085 24 24` | Element |
| `CornersOut` | `Icon/CornersOut` | `868 1085 24 24` | Element |
| `CurrencyCircleDollar` | `Icon/CurrencyCircleDollar` | `340 1037 24 24` | Element |
| `CursorClick` | `Icon/CursorClick` | `914.487 987.484 24 24` | Element |
| `DotsThree` | `Icon/DotsThree` | `1060 989 24 24` | Element |
| `DotsThreeVertical` | `Icon/DotsThreeVertical` | `1108 989 24 24` | Element |
| `DownloadSimple` | `Icon/DownloadSimple` | `340 1085 24 24` | Element |
| `EnvelopeOpen` | `Icon/EnvelopeOpen` | `196 1035.97 24 24` | Element |
| `Eye` | `Icon/Eye` | `820 989 24 24` | Element |
| `FacebookLogo` | `Icon/FacebookLogo` | `820 1133 24 24` | Element |
| `FadersHorizontal` | `Icon/FadersHorizontal` | `484 1085 24 24` | Element |
| `FilePdf` | `Icon/FilePdf` | `1012.5 1036.5 24 24` | Element |
| `FileText` | `Icon/FileText` | `964 1037 24 24` | Element |
| `FileX` | `Icon/FileX` | `532 1037 24 24` | Element |
| `FileXls` | `Icon/FileXls` | `772.108 1132 24 24` | Element |
| `Funnel` | `Icon/Funnel` | `1204 990.07 24 24` | Element |
| `GearSix` | `Icon/GearSix` | `532 989.001 24 24` | Element |
| `Globe` | `Icon/Globe` | `627.874 1133.12 24 24` | Element |
| `GoogleDocsLogo` | `Icon/GoogleDocsLogo` | `964 1133 24 24` | Element |
| `GoogleDriveLogo` | `Icon/GoogleDriveLogo` | `1156 1132 24 24` | Element |
| `GpsFix` | `Icon/GpsFix` | `820 1085 24 24` | Element |
| `GridFour` | `Icon/GridFour` | `1156 1085 24 24` | Element |
| `Headset` | `Icon/Headset` | `1108.01 1134 24 24` | Element |
| `Hourglass` | `Icon/Hourglass` | `916 1085 24 24` | Element |
| `HourglassHigh` | `Icon/HourglassHigh` | `340 1133 24 24` | Element |
| `House` | `Icon/House` | `148 1132.5 24 24` | Element |
| `IdentificationBadge` | `Icon/IdentificationBadge` | `724 1085 24 24` | Element |
| `ImageSquare` | `Icon/ImageSquare` | `1156 1037 24 24` | Element |
| `Info` | `Icon/Info` | `1108 1037 24 24` | Element |
| `InstagramLogo` | `Icon/InstagramLogo` | `676 1133 24 24` | Element |
| `Link` | `Icon/Link` | `1060 1037 24 24` | Element |
| `LinkedinLogo` | `Icon/LinkedinLogo` | `916 1133 24 24` | Element |
| `List` | `Icon/List` | `1108 1085 24 24` | Element |
| `MagnifyingGlass` | `Icon/MagnifyingGlass` | `772.049 989.05 24 24` | Element |
| `MapPinArea` | `Icon/MapPinArea` | `1012 1084.5 24 24` | Element |
| `Medal` | `Icon/Medal` | `532 1085.03 24 24` | Element |
| `Minus` | `Icon/Minus` | `772 1085 24 24` | Element |
| `Nav-ArrowsLeftRight` | `Icon/Nav/ArrowsLeftRight` | `292 575 24 24` | Element |
| `Nav-CalendarDots` | `Icon/Nav/CalendarDots` | `148 574 24 24` | Element |
| `Nav-Cardholder` | `Icon/Nav/Cardholder` | `484 575 24 24` | Element |
| `Nav-Coins` | `Icon/Nav/Coins` | `436 575 24 24` | Element |
| `Nav-CreditCard` | `Icon/Nav/CreditCard` | `244 575 24 24` | Element |
| `Nav-CurrencyCircleDollar` | `Icon/Nav/CurrencyCircleDollar` | `387.874 575.126 24 24` | Element |
| `Nav-CurrencyEth` | `Icon/Nav/CurrencyEth` | `532 575 24 24` | Element |
| `Nav-Envelope` | `Icon/Nav/Envelope` | `580 575 24 24` | Element |
| `Nav-Newspaper` | `Icon/Nav/Newspaper` | `675 575 24 24` | Element |
| `Nav-PersonSimpleTaiChi` | `Icon/Nav/PersonSimpleTaiChi` | `1028 983.486 24 24` | Item |
| `Nav-Receipt` | `Icon/Nav/Receipt` | `340 575.003 24 24` | Element |
| `Nav-SealPercent` | `Icon/Nav/SealPercent` | `628 575 24 24` | Element |
| `Nav-SignOut` | `Icon/Nav/SignOut` | `196.049 575 24 24` | Element |
| `Nav-SquaresFour` | `Icon/Nav/SquaresFour` | `100 575 24 24` | Element |
| `Note` | `Icon/Note` | `580 1133 24 24` | Element |
| `NotePencil` | `Icon/NotePencil` | `292.549 1084.45 24 24` | Element |
| `PaperPlaneRight` | `Icon/PaperPlaneRight` | `820.379 1037 24 24` | Element |
| `Paperclip` | `Icon/Paperclip` | `867.449 1037.05 24 24` | Element |
| `Phone` | `Icon/Phone` | `244.483 1036.49 24 24` | Element |
| `Plus` | `Icon/Plus` | `1252 989 24 24` | Element |
| `PlusSquare` | `Icon/PlusSquare` | `292 989 24 24` | Element |
| `Question` | `Icon/Question` | `435.874 989.125 24 24` | Element |
| `Ruler` | `Icon/Ruler` | `532 1133 24 24` | Element |
| `SealPercent` | `Icon/SealPercent` | `484 1133 24 24` | Element |
| `ShareNetwork` | `Icon/ShareNetwork` | `435.065 1132.94 24 24` | Element |
| `ShoppingCart` | `Icon/ShoppingCart` | `386.519 988.5 24 24` | Element |
| `SidebarSimple` | `Icon/SidebarSimple` | `244 1133 24 24` | Element |
| `SignIn` | `Icon/SignIn` | `290 1037 24 24` | Element |
| `Sliders` | `Icon/Sliders` | `436 1085 24 24` | Element |
| `SmileySticker` | `Icon/SmileySticker` | `915.874 1036.88 24 24` | Element |
| `Sort` | `Icon/Sort` | `1012 989.001 24 24` | Element |
| `Special-AirplaneTilt` | `Icon/Special/AirplaneTilt` | `867.464 734.524 24 24` | Element |
| `Special-AmazonLogo` | `Icon/Special/AmazonLogo` | `101 734.418 24 24` | Element |
| `Special-AppleLogo` | `Icon/Special/AppleLogo` | `146.981 732.004 24 24` | Element |
| `Special-Armchair` | `Icon/Special/Armchair` | `532 733.5 24 24` | Element |
| `Special-Bank` | `Icon/Special/Bank` | `628 733 24 24` | Element |
| `Special-Barbell` | `Icon/Special/Barbell` | `628 830 24 24` | Element |
| `Special-Bed` | `Icon/Special/Bed` | `389 782 24 24` | Element |
| `Special-Bread` | `Icon/Special/Bread` | `531.437 782 24 24` | Element |
| `Special-CalendarCheck` | `Icon/Special/CalendarCheck` | `916 733 24 24` | Element |
| `Special-CalendarSlash` | `Icon/Special/CalendarSlash` | `1300 733 24 24` | Element |
| `Special-Car` | `Icon/Special/Car` | `484 733.5 24 24` | Element |
| `Special-CaretDoubleUp` | `Icon/Special/CaretDoubleUp` | `1252 733 24 24` | Element |
| `Special-CheckSquare` | `Icon/Special/CheckSquare` | `964 782 24 24` | Element |
| `Special-CookingPot` | `Icon/Special/CookingPot` | `724 780 24 24` | Element |
| `Special-Cube` | `Icon/Special/Cube` | `484 829.998 24 24` | Element |
| `Special-CurrencyCircleDollar` | `Icon/Special/CurrencyCircleDollar` | `963.874 734.126 24 24` | Element |
| `Special-Dress` | `Icon/Special/Dress` | `1012 780.5 24 24` | Element |
| `Special-Drop` | `Icon/Special/Drop` | `628 781 24 24` | Element |
| `Special-DropHalfBottom` | `Icon/Special/DropHalfBottom` | `532 829 24 24` | Element |
| `Special-FaceMask` | `Icon/Special/FaceMask` | `1012 733.479 24 24` | Element |
| `Special-Fire` | `Icon/Special/Fire` | `244 781.495 24 24` | Element |
| `Special-FirstAid` | `Icon/Special/FirstAid` | `580 734 24 24` | Element |
| `Special-Fish` | `Icon/Special/Fish` | `578.526 783.466 24 24` | Element |
| `Special-Footprints` | `Icon/Special/Footprints` | `292 782.002 24 24` | Element |
| `Special-ForkKnife` | `Icon/Special/ForkKnife` | `675.5 782.488 24 24` | Element |
| `Special-GoogleLogo` | `Icon/Special/GoogleLogo` | `195.875 733.996 24 24` | Element |
| `Special-GraduationCap` | `Icon/Special/GraduationCap` | `388 735 24 24` | Element |
| `Special-Handbag` | `Icon/Special/Handbag` | `1204 780.5 24 24` | Element |
| `Special-Handshake` | `Icon/Special/Handshake` | `148.024 830.993 24 24` | Element |
| `Special-HouseLine` | `Icon/Special/HouseLine` | `820 733.675 24 24` | Element |
| `Special-Invoice` | `Icon/Special/Invoice` | `915.5 781.5 24 24` | Element |
| `Special-Knife` | `Icon/Special/Knife` | `771.993 781.5 24 24` | Element |
| `Special-Leaf` | `Icon/Special/Leaf` | `100.245 829.756 24 24` | Element |
| `Special-Lightning` | `Icon/Special/Lightning` | `195.997 830 24 24` | Element |
| `Special-ListNumbers` | `Icon/Special/ListNumbers` | `819.988 781.496 24 24` | Element |
| `Special-Monitor` | `Icon/Special/Monitor` | `436 733.049 24 24` | Element |
| `Special-MoonStars` | `Icon/Special/MoonStars` | `340.928 781.573 24 24` | Element |
| `Special-Path` | `Icon/Special/Path` | `436.026 783.534 24 24` | Element |
| `Special-PersonArmsSpread` | `Icon/Special/PersonArmsSpread` | `484.003 781.533 24 24` | Element |
| `Special-PersonSimple` | `Icon/Special/PersonSimple` | `867.996 781.468 24 24` | Element |
| `Special-PersonSimpleBike` | `Icon/Special/PersonSimpleBike` | `243.952 829.014 24 24` | Element |
| `Special-PersonSimpleDeadlifts` | `Icon/Special/PersonSimpleDeadlifts` | `340 830.06 24 24` | Element |
| `Special-PersonSimpleRun` | `Icon/Special/PersonSimpleRun` | `387.495 830.462 24 24` | Element |
| `Special-PersonSimpleTaiChi` | `Icon/Special/PersonSimpleTaiChi` | `292 828.971 24 24` | Element |
| `Special-PintGlass` | `Icon/Special/PintGlass` | `436 830.5 24 24` | Element |
| `Special-ReceiptX` | `Icon/Special/ReceiptX` | `1108 734.003 24 24` | Element |
| `Special-Repeat` | `Icon/Special/Repeat` | `1204 734 24 24` | Element |
| `Special-RocketLaunch` | `Icon/Special/RocketLaunch` | `1299.52 782.46 24 24` | Element |
| `Special-SealCheck` | `Icon/Special/SealCheck` | `1156 734 24 24` | Element |
| `Special-ShoppingCart` | `Icon/Special/ShoppingCart` | `675.506 733.534 24 24` | Element |
| `Special-Sneaker` | `Icon/Special/Sneaker` | `1157.5 780.975 24 24` | Element |
| `Special-Speedometer` | `Icon/Special/Speedometer` | `195.918 780.879 24 24` | Element |
| `Special-SpotifyLogo` | `Icon/Special/SpotifyLogo` | `291.874 734.126 24 24` | Element |
| `Special-Suitcase` | `Icon/Special/Suitcase` | `148 781 24 24` | Element |
| `Special-TShirt` | `Icon/Special/TShirt` | `1060.01 782 24 24` | Element |
| `Special-Ticket` | `Icon/Special/Ticket` | `100 782 24 24` | Element |
| `Special-Umbrella` | `Icon/Special/Umbrella` | `724.004 733.876 24 24` | Element |
| `Special-UserCirclePlus` | `Icon/Special/UserCirclePlus` | `1059.88 734.126 24 24` | Element |
| `Special-Warehouse` | `Icon/Special/Warehouse` | `1252.01 780.993 24 24` | Element |
| `Special-Warning` | `Icon/Special/Warning` | `772 733.5 24 24` | Element |
| `Special-Watch` | `Icon/Special/Watch` | `1108 782 24 24` | Element |
| `Special-WindowsLogo` | `Icon/Special/WindowsLogo` | `243 734 24 24` | Element |
| `Special-Wrench` | `Icon/Special/Wrench` | `580 829.948 24 24` | Element |
| `Special-XLogo` | `Icon/Special/XLogo` | `339.996 734.01 24 24` | Element |
| `SpinnerGap` | `Icon/SpinnerGap` | `196 1133 24 24` | Element |
| `ThumbsUp` | `Icon/ThumbsUp` | `868.015 987.5 24 24` | Element |
| `Timer` | `Icon/Timer` | `1203.88 1084.12 24 24` | Element |
| `Trash` | `Icon/Trash` | `100 1132 24 24` | Element |
| `TrendDown` | `Icon/TrendDown` | `1300 989.001 24 24` | Element |
| `TrendUp` | `Icon/TrendUp` | `1156 989.001 24 24` | Element |
| `TwitterLogo` | `Icon/TwitterLogo` | `868 1133 24 24` | Element |
| `UserCircle` | `Icon/UserCircle` | `1204 1037 24 24` | Element |
| `UserCircleCheck` | `Icon/UserCircleCheck` | `1060.38 1084.99 24 24` | Element |
| `UserSwitch` | `Icon/UserSwitch` | `1252 1037 24 24` | Element |
| `Users` | `Icon/Users` | `580.009 1084.92 24 24` | Element |
| `VideoCamera` | `Icon/VideoCamera` | `293 1133 24 24` | Element |
| `VirtualAccount` | `Icon/VirtualAccount` | `244.068 989.07 24 24` | Element |
| `Wallet` | `Icon/Wallet` | `196.5 989 24 24` | Element |
| `WarningOctagon` | `Icon/WarningOctagon` | `484 1037 24 24` | Element |
| `WechatLogo` | `Icon/WechatLogo` | `1204.01 1133.03 24 24` | Element |
| `X` | `Icon/X` | `436 1037 24 24` | Element |
| `XLogo` | `Icon/XLogo` | `1012 1133.01 24 24` | Element |
| `YoutubeLogo` | `Icon/YoutubeLogo` | `724 1132.99 24 24` | Element |
| `ZoomLogo` | `Icon/ZoomLogo` | `1060 1133 24 24` | Element |
