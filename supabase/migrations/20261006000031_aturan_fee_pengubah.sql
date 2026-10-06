-- Siapa yang terakhir mengubah aturan fee tim.
--
-- Kop halaman Aturan Fee Tim menulis "terakhir diubah <kapan> oleh <siapa>".
-- `updated_at` sudah ada (trigger touch_updated_at); yang belum ada orangnya.
-- Dengan dua akun penulis (master dan staf penginput), "oleh siapa" adalah
-- satu-satunya cara tahu angka bayaran tim diubah oleh orang yang berhak
-- memutuskannya.
--
-- Boleh kosong: baris yang ada belum pernah diubah lewat panel sejak kolom
-- ini lahir, dan `on delete set null` supaya menghapus akun tidak bisa
-- menghapus (atau menggagalkan) aturan fee studio.
--
-- Tanpa GRANT baru: tabelnya sudah ada beserta GRANT dan policy-nya, dan
-- menambah kolom tidak membuka akses apa pun.

alter table public.studio_fee_settings
  add column updated_by uuid references auth.users (id) on delete set null;
