-- Kredit proyek: kontraktor, lighting, dan fotografer.
--
-- Ketiganya sudah tampil di blok CREDITS halaman proyek publik sejak awal,
-- tapi namanya di-hardcode sebagai null di apps/web/src/lib/menunggu.ts dan
-- tercetak sebagai "Name to be credited" untuk SETIAP proyek. Berkas itu
-- bahkan sudah menuliskan rencananya: "kalau suatu saat dibuatkan kolomnya,
-- tempatnya per proyek, bukan satu daftar untuk seluruh studio, karena
-- fotografernya bisa berbeda". Ini kolomnya.
--
-- Per proyek, bukan di studio_settings, karena persis itu alasannya: satu
-- rumah dipotret fotografer A, satu kafe oleh B, dan kontraktornya hampir
-- selalu berbeda.
--
-- Tidak ada GRANT baru: ini kolom pada tabel yang sudah ada, dan GRANT di
-- Postgres berlaku per tabel. Hak yang sudah dipasang migrasi sebelumnya
-- untuk public.projects otomatis mencakup kolom-kolom ini.

alter table public.projects
  add column contractor        text,
  add column lighting_designer text,
  add column photographer      text;

comment on column public.projects.contractor is
  'Nama kontraktor pelaksana. Tampil di blok CREDITS halaman proyek publik.';
comment on column public.projects.lighting_designer is
  'Nama perancang pencahayaan. Kosong = tampil sebagai "Name to be credited".';
comment on column public.projects.photographer is
  'Nama fotografer arsitektur. Wajib diisi kalau fotonya bukan milik studio.';
