-- Thumbnail foto galeri.
--
-- Rel pemilih foto di bawah galeri (kotak 120x62, sepuluh buah) memuat foto
-- yang SAMA dengan foto besar di atasnya. Berkasnya sudah dikecilkan di
-- browser saat diunggah — sisi terpanjang 2560px, lihat
-- apps/web/src/lib/kecilkanFoto.ts — tapi 2560px yang dilukis ke dalam kotak
-- selebar 120px tetap berarti peramban mendekode sekitar dua puluh kali
-- piksel yang dipakainya. Sepuluh kali, di halaman yang sama, di ponsel klien.
--
-- Kolom ini menyimpan key R2 dari versi kecilnya. NULLABLE dengan sengaja:
-- foto yang sudah telanjur diunggah tidak punya thumbnail, dan situsnya harus
-- tetap menampilkannya — yang kosong jatuh kembali ke foto penuh, persis
-- seperti sekarang. Thumbnail hanya dibuat untuk unggahan baru.
--
-- Tidak ada GRANT baru: ini kolom pada tabel yang sudah ada, dan GRANT di
-- Postgres berlaku per tabel. Hak yang dipasang 20260818000002 untuk
-- public.project_images otomatis mencakup kolom ini.

alter table public.project_images
  add column thumb_key text;

comment on column public.project_images.thumb_key is
  'Key R2 versi kecil foto ini (sisi panjang 400px, WebP), dipakai rel pemilih '
  'foto di halaman proyek dan beranda. NULL = belum punya; pemakainya jatuh '
  'kembali ke storage_key.';
