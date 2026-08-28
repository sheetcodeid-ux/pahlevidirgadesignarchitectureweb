# Design System

Bahasa visual: **neo-brutalism**, menggabungkan Wise, Framer, dan Gumroad.
Referensi visual datang dari pemilik berupa gambar.

Halaman **UI Component** (hanya master admin) adalah sumber kebenaran. Fitur
baru mengambil komponen dari sana. Membuat komponen baru di luar halaman itu —
tanpa mendaftarkannya — adalah cara paling cepat membuat antarmuka jadi tidak
konsisten.

## Keputusan teknis: React island di dalam Astro

Astro tetap jadi kerangka situs; komponen interaktif dimuat sebagai island
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

Typography · Separator · Aspect Ratio · Skeleton · Spinner · Badge · Kbd ·
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
Resizable · Message Scroller · Questionnaire · Attachment

### Utilitas

Direction (konteks LTR/RTL)

## Status

Seluruh 65 komponen selesai dan terdaftar di halaman UI Component
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
| Display | Newsreader | Judul halaman dan momen bernada manusia |
| UI | Plus Jakarta Sans | Seluruh perkakas sehari-hari |
| Data | IBM Plex Mono | Angka, kode, dan nilai yang berjajar |

Plus Jakarta Sans dipilih bukan hanya karena bentuknya cocok — typeface itu
dirancang di Indonesia untuk identitas kota Jakarta.

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
