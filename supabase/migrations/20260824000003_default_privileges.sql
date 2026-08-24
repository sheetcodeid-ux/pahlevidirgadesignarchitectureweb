-- Menutup tabel masa depan secara bawaan.
--
-- Dua migrasi sebelumnya mencabut hak anon dan authenticated atas empat tabel
-- yang ada, lalu memberikannya kembali seperlunya. Tapi itu hanya berlaku
-- untuk tabel yang sudah ada saat itu. Tabel yang dibuat setelahnya kembali
-- mengikuti default privileges bawaan Supabase.
--
-- Migrasi ini membalik bawaannya: tabel baru di schema public tidak memberi
-- apa pun kepada anon maupun authenticated. Konsekuensinya disengaja — setiap
-- tabel baru jadi WAJIB disertai GRANT eksplisit, kalau tidak ia tidak akan
-- bisa dibaca siapa pun lewat PostgREST. Lebih baik gagal keras saat
-- pengembangan daripada tabel bocor diam-diam ke publik.
--
-- Tidak menyentuh tabel yang sudah ada; GRANT dari 20260818000002 tetap utuh.
-- Backend Go memakai service_role dan melewati semua ini.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
