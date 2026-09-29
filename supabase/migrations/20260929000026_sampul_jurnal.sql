-- Gambar sampul tulisan jurnal.
--
-- Dipilih pemilik saat halaman Jurnal panel dibangun mengikuti frame
-- "37. Insights", yang setiap kartunya bergambar. Sampulnya juga dipakai
-- indeks /jurnal publik dan kartu bagikan tiap tulisan.
--
-- Boleh kosong, dan itu disengaja: tulisan yang sudah ada tidak punya
-- sampul, dan tulisan berencana memang belum punya apa-apa. Tanpa sampul,
-- kartunya jatuh ke bidang warna kategori — bukan celah abu.
--
-- Berkasnya di R2 lewat folder `jurnal/`, dengan alasan yang sama seperti
-- `studio/` dan `klien/`: aset yang bukan milik proyek tidak boleh ikut
-- terhapus saat proyek dibersihkan. CHECK menjaga kuncinya memang di folder
-- itu, supaya kolom ini tidak bisa diarahkan ke foto proyek yang masih draf.

alter table public.journal_posts
  add column cover_key text
  check (cover_key is null or cover_key ~ '^jurnal/[A-Za-z0-9._-]+$');

-- Tidak ada GRANT baru: hak atas journal_posts diberikan per TABEL
-- (20260909000018), jadi kolom baru ikut aturan barisnya — anon cuma melihat
-- sampul tulisan yang sudah terbit.
