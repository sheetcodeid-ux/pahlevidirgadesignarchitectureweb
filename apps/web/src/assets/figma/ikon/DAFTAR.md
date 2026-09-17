# Ikon asli dari Figma — Coinest

Berkas SVG di folder ini **diekspor sendiri oleh pemilik dari Figma**, bukan
hasil tracing dan bukan hasil unduhan otomatis. Keduanya tidak mungkin:

- Menggambar ulang dari tangkapan layar = menjiplak, tidak akan pernah persis.
- Mengunduh lewat connector = URL asetnya di `www.figma.com`, dan gateway
  jaringan sesi Claude menolak host itu (kebijakan organisasi). Terukur:
  `http:000`, `connect_rejected`. Tidak ada setelan Figma yang mengubahnya.

Jadi folder ini **satu-satunya sumber kebenaran bentuk ikon**. Jangan
menggantinya dengan ikon karangan, dan jangan menyuntingnya "supaya rapi" —
kalau bentuknya salah, yang diperbaiki ekspornya di Figma.

## Setelan ekspor yang dipakai

Disepakati sebelum batch pertama dikirim, dan harus sama untuk seluruh batch:

| Opsi Figma | Nilai |
| --- | --- |
| Format | **SVG** |
| Suffix | kosong |
| Color profile | **sRGB** |
| Ignore overlapping layers | **nyala** |
| Include bounding box | **nyala** — ini yang menyamakan `viewBox` tiap ikon |
| Include "id" attribute | **nyala** — nama layer Figma ikut masuk, dipakai memetakan |
| Outline text | nyala |

`Include bounding box` bukan pilihan bebas: tanpa itu `viewBox` memeluk ketat
gambar masing-masing, jadi dua ikon yang dipasang `size={24}` tampil beda
besar. Kalau suatu saat ada ikon yang ukurannya terasa meleset, periksa
`viewBox`-nya lebih dulu.

## Cara ikon masuk ke kode

Berkas mentah disimpan apa adanya di sini, lalu dijadikan komponen di
`apps/web/src/components/ui/Icon.tsx`. Yang boleh berubah saat dipindahkan:

- `fill`/`stroke` warna tetap diganti `currentColor`, supaya ikon ikut warna
  teks di sekitarnya. Warna yang memang bagian dari lambang (mis. logo
  dua warna) TIDAK diganti.
- Atribut `width`/`height` dilepas dari elemen akar; ukurannya diatur prop
  `size`. `viewBox` **tidak pernah** diubah.

Jebakan #7 di CLAUDE.md tetap berlaku: `svg[width][height]` butuh
`flex: none; max-width: none;` supaya tidak menyusut jadi 0x0 di kolom sempit.

## Daftar ikon yang sudah masuk

Diisi tiap kali satu batch tiba. Kolom "nama Figma" diambil dari atribut `id`
di dalam berkasnya, bukan dari nama berkas — nama berkas bisa berubah saat
di-zip, atribut `id` tidak.

| # | Berkas | Nama layer Figma | viewBox | Dipakai di |
| --- | --- | --- | --- | --- |
| _(belum ada)_ | | | | |

## Batch

| Batch | Jumlah | Tanggal | Catatan |
| --- | --- | --- | --- |
| _(menunggu batch 1)_ | | | |
