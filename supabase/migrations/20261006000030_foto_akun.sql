-- Foto pribadi akun staf.
--
-- Diminta pemilik: halaman Akun harus bisa mengunggah foto sendiri, sama
-- seperti Info Studio mengunggah logo studio. Fotonya dipakai di panel saja
-- (avatar halaman Akun, kartu staf, kartu akun di rel) — situs publik tidak
-- membacanya.
--
-- Boleh kosong: akun tanpa foto tetap tampil dengan inisialnya. Berkasnya di
-- R2 lewat folder `akun/`, dengan alasan yang sama seperti `studio/`,
-- `klien/`, dan `jurnal/`: aset yang bukan milik proyek tidak boleh ikut
-- terhapus saat proyek dibersihkan. CHECK menjaga kuncinya memang di folder
-- itu, supaya kolom ini tidak bisa diarahkan ke foto proyek yang masih draf.

alter table public.profiles
  add column avatar_key text
  check (avatar_key is null or avatar_key ~ '^akun/[A-Za-z0-9._-]+$');

-- Tidak ada GRANT baru: hak atas profiles diberikan per TABEL
-- (20260818000002), jadi kolom baru ikut aturan barisnya. Panel menulisnya
-- lewat Worker API (Hyperdrive), bukan lewat peran authenticated.
