# Design System

Bahasa visual: **neo-brutalism**, menggabungkan Wise, Framer, dan Gumroad.
Referensi visual datang dari pemilik berupa gambar.

Halaman **UI Component** (hanya master admin) adalah sumber kebenaran. Fitur
baru mengambil komponen dari sana. Membuat komponen baru di luar halaman itu —
tanpa mendaftarkannya — adalah cara paling cepat membuat antarmuka jadi tidak
konsisten.

## Keputusan teknis: React island di dalam Astro

Astro tetap jadi rangka situs; komponen interaktif dimuat sebagai island
React. Alasannya bukan preferensi, tapi hitung-hitungan:

Dari 65 komponen, sekitar 20 bergantung pada perilaku yang tidak terlihat mata
namun mudah salah — focus trap, roving tabindex, hubungan ARIA, penempatan yang
sadar tepi layar, pengembalian fokus saat overlay tertutup. Dialog, Combobox,
Command, Select, Context Menu, dan Menubar semuanya masuk kelompok ini.

Menulis sendiri lapisan itu untuk 20 komponen berarti pekerjaan berminggu-minggu
yang kegagalannya tidak kelihatan di layar — hanya pengguna keyboard dan
pembaca layar yang menemukannya, dan biasanya setelah rilis.

Rencananya: pakai primitif headless untuk lapisan perilaku itu, lalu **seluruh
tampilan ditulis sendiri**. Primitif headless tidak membawa satu pun gaya
bawaan, jadi "custom" tetap utuh: setiap piksel milik kita, yang dipinjam hanya
pipa yang tak terlihat.

Kalau pemilik lebih suka nol dependensi, itu tetap bisa — konsekuensinya
timeline jauh lebih panjang dan risiko aksesibilitas ditanggung sendiri. Ini
keputusan pemilik, bukan keputusan teknis murni.

## Inventaris

65 komponen, dikelompokkan menurut apa yang dibutuhkan untuk membangunnya.

### Tampilan statis — CSS saja

Typography · Separator · Aspect Ratio · Skeleton (+ varian berbentuk) · Spinner · Badge · Kbd ·
Avatar · Card · Empty · Item · Label · Marker · Progress · Alert · Bubble ·
Message

### Form

Button · Button Group · Input · Input Group · Input Rupiah · Textarea ·
Checkbox · Radio Group · Switch · Native Select · Field · Slider · Input OTP ·
Toggle · Toggle Group

### Overlay — butuh focus trap dan penempatan

Dialog · Alert Dialog · Sheet · Drawer · Popover · Hover Card · Tooltip ·
Dropdown Menu · Context Menu · Menubar · Command · Combobox · Select · Toast

### Navigasi

Sidebar · Navigation Menu · Breadcrumb · Tabs · Pagination

### Disclosure

Accordion · Collapsible

### Data dan konten

Table · Data Table · Chart · Calendar · Date Picker · Carousel · Scroll Area ·
Resizable · Message Scroller · Questionnaire · Attachment · Voice Note

### Utilitas

Direction (konteks LTR/RTL)

### Papan angka

`apps/web/src/components/ui/data/Dashboard.tsx` — bentuk yang diturunkan dari
referensi papan pasar milik pemilik.

> **Halaman yang memakainya sudah tidak ada.** Seluruh tampilan Keuangan
> dihapus atas permintaan pemilik dan akan dirancang ulang dari nol; primitif
> di bawah ini tetap ada di katalog karena bentuknya umum, bukan khusus
> Keuangan. Kalau layar baru nanti tidak memakainya juga, hapus berkasnya
> sekalian — jangan dibiarkan jadi katalog yang tidak pernah dipanggil. Yang ditiru **susunan dan kepadatannya**,
bukan warnanya: di situs ini warna punya makna tetap, dan referensi itu memakai
warna yang artinya berbeda.

| Komponen | Kegunaan |
| --- | --- |
| `StripMetrik` | Satu bilah berisi 4 angka dipisah garis — bukan 4 kartu berbingkai |
| `Delta` + `bandingkan()` | Perubahan berpanah. Persen hanya kalau basisnya positif |
| `KartuPapan` | Judul berchevron, angka besar + delta, isi, tab di KAKI |
| `AreaChart` | Grafik bidang, sumbu nilai di kanan, garis putus-putus di puncak |
| `StackedBarChart` | Batang bertumpuk yang berani turun di bawah nol |
| `Gauge` | Busur berjarum 0–100 dengan zona semantik |
| `Sparkline` | Garis mungil tanpa sumbu |
| `KartuMini` | Label berchevron, keterangan, angka, badge status |

Aturan yang paling mudah dilanggar ada di `bandingkan()`: **persentase hanya
bermakna kalau basisnya positif.** Laba bersih yang bergerak dari −25 juta ke
+22 juta menghasilkan "+188%" — angka yang terbaca seperti untung berlipat
padahal yang terjadi berbalik dari rugi. Untuk kasus itu yang ditampilkan
selisih rupiahnya.

### Kartu angka

`.card.stat` — ikon + label sebaris di atas, angkanya sendirian di bawah pada
`--text-xl`. Bukan gaya bebas: dengan angka di sebelah ikon, kotaknya hanya
174px sementara `Rp185.000.000` pada `--text-2xl` butuh 238px, jadi angkanya
terpotong di setiap kartu. Terukur, bukan dikira.

Angka minus memakai `.angka-minus` (merah brand). Tanda minus setipis itu
hilang di antara digit, dan `−Rp92.000.000` terlalu mirip `Rp92.000.000` saat
dipindai sekilas.

Deretan kartu angka memakai `.spec-grid--empat` atau `.spec-grid--tiga-tetap`,
bukan `.spec-grid` bawaan: yang bawaan menghitung berapa kolom yang MUAT, jadi
empat kartu jatuh 3+1 dan menyisakan dua sel kosong.

### Grafik batang bernilai minus

`BarChart` menggambar nilai negatif turun dari garis nol, batangnya merah, dan
garis nolnya dipertebal. Sebelumnya sumbunya selalu mulai dari nol dan batang
negatif tidak pernah tergambar sama sekali — laba bersih yang minus, justru
angka yang paling perlu dilihat, menghilang tanpa jejak.

### Satu bentuk untuk semua daftar

`apps/web/src/components/ui/data/DataTable.tsx` bukan sekadar salah satu
komponen di daftar di atas — ia **bentuk baku setiap daftar di panel admin**,
diturunkan langsung dari halaman Semua Proyek. Isinya, dari atas ke bawah:

1. `.listbar__main` — kotak cari selebar bilah, opsional sel tampilan
   (`.listbar__views`) dan tombol aksi utama (`.listbar__cta`)
2. `.listbar__filters` — chip status berangka + tombol Saringan (Popover)
3. `.listcount` — "1–N dari M <satuan>"
4. `table.table.table--ruled` dengan kolom `#` (`.table__idx`) yang
   ditambahkan sendiri oleh komponennya
5. Keadaan kosong `.empty`, dan skeleton `SkeletonTabel` saat `data` masih
   `null`

Pemanggil cuma memberi kolom, chip, dan isi panel saringan. Yang penting:
`kolomSkeleton()` menurunkan skeleton dari kolom tabelnya sendiri, jadi
keduanya tidak bisa hanyut berbeda.

Membuat daftar baru berarti memakai komponen ini. Kalau kebutuhannya tidak
muat, perluas komponennya — jangan membangun tabel kedua.

Dua prop membuatnya cukup untuk semua daftar yang ada:

- `tampilan` mengisi sel `.listbar__views` — dipakai pengalih tabel/kanban di
  List Kerjaan dan tabel/kartu di Semua Proyek
- `gantiIsi(terlihat)` menggambar sesuatu selain tabel dengan baris yang
  sudah tersaring dan terurut. Kanban List Kerjaan memakainya, jadi
  pencarian, chip, dan panel saringan tetap satu tempat

Yang memakainya sekarang: Pesan Masuk, Direktori, Testimoni, List Kerjaan,
dan tabel proyek di Keuangan. Tim & Freelancer belum — daftar itu akan jadi
kartu berfoto, bukan tabel.

### Skeleton berbentuk

`apps/web/src/components/ui/Skeleton.tsx` — `SkeletonBaris`, `SkeletonDaftar`,
`SkeletonKartu`, `SkeletonStat`, `SkeletonIsian`, `SkeletonKotak`,
`SkeletonTeks`, `Balok`.

Aturannya satu dan itu yang membuatnya tidak lekang: **placeholder memakai
kelas markup yang sama dengan komponen aslinya** (`.card`, `.item`, `.field`,
`.spec-grid`), lalu isinya diganti balok. Tinggi, jarak, dan radiusnya ikut
sendiri saat komponen aslinya berubah — tidak ada angka yang perlu
diselaraskan tangan. Karena itu komponen di sana **tidak menerima ukuran
piksel**: begitu pemanggil boleh menentukan tinggi baris, jaminan itu hilang.

`RequireAuth` menerima prop `skeleton`. Tiap panel mengirim bentuk halamannya
sendiri — bentuk yang sama yang ia pakai saat menunggu datanya — supaya
halaman tersusun sekali, bukan spinner dulu lalu skeleton lalu isi.

**Skeleton ditahan 180 ms** lewat kelas `.skeleton--tunda`. Astro memanggang
hasil render awal island ke HTML, jadi kerangkanya sudah terlukis browser
sebelum React sempat berjalan — cache secepat apa pun tidak mencegah itu, dan
terukur 5 dari 5 frame pertama menampilkannya pada halaman yang datanya sudah
tersimpan. Kedipan 80 ms terbaca seperti halaman rusak sekejap, lebih buruk
daripada tidak ada skeleton sama sekali. Penahannya murni CSS, bukan timer
JavaScript, justru karena yang perlu ditahan adalah HTML yang sudah ada
sebelum satu baris JS pun dieksekusi.

**Bentuknya diukur, bukan dikira.** Baris tabel skeleton di Semua Proyek harus
setinggi baris sungguhannya — 68 px lawan 68 px, bukan 38 lawan 68. Bandingkan
`getBoundingClientRect()` skeleton dengan isinya sebelum menganggap selesai.

## Status

Seluruh 66 komponen selesai dan terdaftar di halaman UI Component
(`/admin/ui`). Fitur baru mengambil dari sana.

## Urutan pengerjaan

Dibangun bergelombang, bukan sekaligus. Tiap gelombang menghasilkan sesuatu
yang bisa dilihat dan dinilai, sehingga arah visual bisa dikoreksi lebih awal
ketimbang setelah 64 komponen terlanjur jadi.

| Gelombang | Isi | Kenapa duluan |
| --- | --- | --- |
| 0 ✅ | Token, Typography, Button | **Selesai** |
| 1 ✅ | Sidebar, Breadcrumb, Card, Badge, Separator, Item, Icon, Theme Toggle, halaman UI Component | **Selesai** |
| 2 ✅ | Seluruh kelompok Form | **Selesai** |
| 3 ✅ | Seluruh kelompok Overlay | **Selesai** |
| 4 ✅ | Data dan konten | **Selesai** |
| 5 ✅ | Sisanya | **Selesai** |

## Hak akses halaman UI Component

Hanya **master admin**. Tabel `public.profiles` sudah punya kolom `role` dengan
nilai `admin` dan `editor`, jadi pemetaannya:

- superadmin → `role = 'admin'` → bisa membuka halaman UI Component
- staf penginput → `role = 'editor'` → tidak bisa

Belum diputuskan: apakah perlu peran ketiga bernama `superadmin` yang terpisah
dari `admin`. Untuk dua orang, `admin`/`editor` sudah cukup — kalau ternyata
perlu, itu satu migrasi kecil.

Endpoint `/api/v1/admin/me` saat ini belum mengembalikan `role`. Perlu
ditambahkan sebelum halaman ini bisa menggatingkan aksesnya.

## Tipografi

| Peran | Typeface | Dipakai untuk |
| --- | --- | --- |
| Display | Geist | Judul halaman, bobot 700, `--tracking-judul` |
| UI | Geist | Seluruh perkakas sehari-hari |
| Data | Geist Mono | Angka, kode, dan nilai yang berjajar |

Display dan UI memakai keluarga yang SAMA. Itu bukan kelalaian — begitulah
produk SaaS menyusun tipografinya: yang membedakan judul dari teks biasa
adalah ukuran, bobot, dan kerapatan huruf, bukan keluarga kedua. Tokennya
tetap dipisah (`--font-display` dan `--font-sans`) supaya suatu saat bisa
dipisah lagi tanpa menyentuh satu pun komponen.

Dua setelan yang wajib ikut kalau keluarga fontnya diganti lagi:

1. **Judul berbobot 700, bukan 400.** Serif berukuran besar sudah punya bobot
   dari bentuknya sendiri; grotesk tidak, dan pada 400 judulnya terbaca kendur.
2. **`--tracking-judul` (−0,032em), bukan `--tracking-tight` (−0,015em).**
   Pada 44px, −0,015em masih terbaca renggang untuk grotesk.

Susunan sebelumnya adalah Newsreader / Plus Jakarta Sans / IBM Plex Mono.
Diganti atas permintaan pemilik: serif untuk judul dinilai tidak cocok di
panel seperti ini, dan mono berslab terasa seperti font bawaan alat AI.

## Tema terang dan gelap

Gelap adalah bawaan; terang adalah pasangan yang setara, bukan renungan.
Setiap warna semantik punya nilai sendiri di tiap tema — amber `#f0a92c` yang
terbaca jelas di atas hitam menjadi `#9a6206` di atas putih. Membalik warna
secara otomatis akan membuat sebagian teks tidak terbaca.

Peralihannya dianimasikan: `ThemeToggle` memasang kelas `.theme-switching`
sesaat sebelum mengganti atribut, sehingga halaman meluncur antar-warna alih-alih
berkedip, lalu melepasnya lagi agar hover dan fokus tetap gesit. Skrip inline di
`<head>` menetapkan tema sebelum paint pertama supaya tidak ada kedipan saat
halaman dimuat.

## Warna grafik

Tiga warna kategorikal, bukan enam. Angkanya bukan selera — validator memeriksa
jarak antar-warna pada simulasi buta warna protan, deutan, dan tritan untuk
**semua** pasangan, dan tiga adalah jumlah terbanyak yang masih lolos tanpa
peringatan pada kedua tema. Deret keempat melebur jadi "Lainnya" atau dipecah
jadi beberapa grafik kecil.

| Tema | Slot 1 | Slot 2 | Slot 3 | Permukaan uji |
| --- | --- | --- | --- | --- |
| Gelap | `#3f9bd0` | `#c08400` | `#0e8f6b` | `#141414` |
| Terang | `#155ba6` | `#b57000` | `#12a06d` | `#ffffff` |

Aturan yang menyertainya:

- **Warna status tidak boleh jadi warna deret.** Merah, amber, hijau, dan biru
  sudah punya makna; memakainya sebagai "deret ke-4" merusak keduanya.
- **Besaran memakai satu warna**, bukan satu warna per batang. Warna
  kategorikal hanya untuk identitas yang harus dilacak lintas deret.
- **Tidak pernah sumbu ganda.** Dua besaran berbeda skala dipecah jadi dua
  grafik atau diindeks ke basis yang sama.
- **Teks memakai token teks, tidak pernah warna deret.** Identitas dibawa oleh
  mark di sebelahnya.
- **Setiap grafik menyediakan tampilan tabel**, sehingga isinya tetap terbaca
  tanpa mengandalkan penglihatan warna.

Kalau palet ini diubah, jalankan ulang validatornya sebelum di-commit — jangan
menilainya dengan mata.

## Aturan yang mengikat

1. Setiap komponen tampil di halaman UI Component beserta variannya dan
   kondisi kosong/loading/error-nya, bukan hanya kondisi idealnya
2. Warna, ukuran, dan spasi diambil dari token — tidak ada nilai literal di
   dalam komponen
3. Setiap komponen bekerja penuh dengan keyboard, dan punya status fokus yang
   terlihat jelas. Pada gaya neo-brutalism ini justru gampang: outline tebal
   memang bagian dari bahasanya
4. Hormati `prefers-reduced-motion`
5. Komponen baru tidak dianggap ada sampai terdaftar di halaman UI Component
