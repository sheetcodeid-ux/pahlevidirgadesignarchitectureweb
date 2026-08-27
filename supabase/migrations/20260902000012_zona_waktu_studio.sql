-- Zona waktu studio, dipilih di panel Info Studio dan dipakai topbar admin
-- untuk menampilkan jam serta tanggal setempat.
--
-- Disimpan sebagai nama zona IANA (Asia/Jakarta / Asia/Makassar / Asia/Jayapura),
-- bukan singkatan WIB/WITA/WIT. Singkatan itu label untuk manusia; yang bisa
-- dipakai Intl.DateTimeFormat untuk benar-benar menghitung waktu adalah nama
-- IANA-nya. Menyimpan singkatannya berarti memetakan ulang di setiap tempat
-- yang membutuhkannya.
--
-- Kolom baru di tabel yang sudah ada — GRANT tabel di migrasi 20260826000005
-- (select untuk anon, select+update untuk authenticated) otomatis mencakupnya,
-- tidak perlu GRANT baru.

alter table public.studio_settings
  add column timezone text not null default 'Asia/Jakarta';

-- Nilainya dibatasi ke tiga zona Indonesia. Zona bebas akan membuat topbar
-- menampilkan waktu yang tidak pernah dimaksudkan siapa pun kalau ada salah
-- ketik, dan studio ini hanya beroperasi di Indonesia.
alter table public.studio_settings
  add constraint studio_settings_timezone_valid
  check (timezone in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'));
