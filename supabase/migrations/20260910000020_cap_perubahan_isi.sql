-- Cap waktu "isi publik terakhir berubah", untuk tombol Terbitkan di panel.
--
-- Situs publik dibekukan saat build (invarian 4 & 5 di CLAUDE.md), jadi
-- mengubah data di panel admin TIDAK mengubah situs sampai ada build ulang.
-- Itu memang disengaja — tapi tidak ada apa pun di panel yang mengatakannya,
-- dan pemilik sudah sekali mengira fiturnya rusak: dia mengisi nama klien dan
-- mengunggah delapan logo pukul 10.10–10.13, sementara build terakhir jam
-- 10.04. Datanya benar seluruhnya; yang salah cuma tidak ada yang memberi
-- tahu dia bahwa situsnya perlu dibangun ulang.
--
-- Kenapa tabel dan bukan `max(updated_at)` dari tiap tabel:
-- MENGHAPUS tidak meninggalkan baris yang bisa dijumlahkan. Menghapus foto,
-- menarik tulisan jurnal, membuang satu logo klien — persis perbuatan yang
-- paling bikin panik kalau barangnya masih tampil di situs — semuanya tidak
-- terlihat sama sekali oleh max(updated_at). Satu baris yang dicap oleh
-- trigger menangkap ketiga jenis perubahan dengan cara yang sama.

create table public.content_revision (
  -- Satu baris, selamanya. Check constraint-nya yang menjamin: tanpa itu,
  -- baris kedua akan membuat "kapan terakhir berubah" jadi pertanyaan yang
  -- punya dua jawaban.
  id         smallint primary key default 1 check (id = 1),
  changed_at timestamptz not null default now()
);

insert into public.content_revision (id) values (1);

-- security definer, dan itu memang perlu di sini.
--
-- Peran `authenticated` boleh menulis ke tabel-tabel di bawah lewat kebijakan
-- RLS, tapi tidak punya hak apa pun atas content_revision — dan memang tidak
-- boleh punya. Tanpa definer, setiap tulisan staf lewat PostgREST akan gagal
-- dengan "permission denied for table content_revision", dan rls_test.sql
-- ikut jatuh seluruhnya.
--
-- Yang membuatnya aman: fungsinya tidak menerima satu pun argumen, tidak
-- menyusun SQL dinamis, dan hanya menyentuh satu baris yang isinya waktu.
-- search_path dikunci supaya nama tabelnya tidak bisa dibajak lewat skema
-- lain yang kebetulan lebih dulu di jalur pencarian.
create or replace function public.touch_content_revision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- clock_timestamp(), bukan now(): now() adalah waktu MULAI transaksi, jadi
  -- ia sama persis untuk setiap perubahan di dalam satu transaksi — dan di
  -- dalam rls_test.sql, yang seluruhnya satu transaksi, capnya tidak pernah
  -- bergerak sedikit pun. Yang dicatat di sini memang "kapan tepatnya", bukan
  -- "transaksi yang mana".
  update public.content_revision set changed_at = clock_timestamp() where id = 1;
  return null;
end;
$$;

-- Dicabut dari PUBLIC, bukan dari anon/authenticated: Postgres memberi
-- execute kepada PUBLIC, jadi mencabut dari peran saja tidak menutup apa pun
-- (jebakan yang sudah menggigit sekali di is_staff(), lihat 20260824000004).
-- Trigger tetap berjalan sesudahnya — haknya diperiksa saat trigger DIBUAT,
-- bukan saat menyala; itu pola yang sama dengan touch_updated_at().
revoke execute on function public.touch_content_revision() from public;
revoke execute on function public.touch_content_revision() from anon, authenticated;

-- Per-statement, bukan per-baris: satu penghapusan 20 foto cukup mencap
-- sekali. Konsekuensinya, statement yang tidak mengubah baris apa pun tetap
-- mencap — dan itu arah meleset yang benar: paling buruk tombolnya bilang
-- "ada perubahan" padahal tidak, bukan diam padahal ada.
--
-- Enam tabel ini persis yang dibaca saat build (apps/web/src/lib/api.ts):
-- proyek beserta gambarnya, info studio, testimoni, jurnal, dan logo klien.
-- Tabel yang hanya dipakai panel admin atau portal klien TIDAK ikut — datanya
-- diambil saat halaman dibuka, jadi tidak pernah basi karena build.
create trigger projects_cap_isi
  after insert or update or delete on public.projects
  for each statement execute function public.touch_content_revision();

create trigger project_images_cap_isi
  after insert or update or delete on public.project_images
  for each statement execute function public.touch_content_revision();

create trigger studio_settings_cap_isi
  after insert or update or delete on public.studio_settings
  for each statement execute function public.touch_content_revision();

create trigger testimonials_cap_isi
  after insert or update or delete on public.testimonials
  for each statement execute function public.touch_content_revision();

create trigger journal_posts_cap_isi
  after insert or update or delete on public.journal_posts
  for each statement execute function public.touch_content_revision();

create trigger client_logos_cap_isi
  after insert or update or delete on public.client_logos
  for each statement execute function public.touch_content_revision();

alter table public.content_revision enable row level security;

-- Tanpa satu pun policy dan tanpa satu pun grant untuk anon/authenticated.
-- Yang membacanya cuma Worker API lewat Hyperdrive, yang memakai peran
-- pemilik database dan melewati RLS. Ini bukan data publik: ia memberi tahu
-- jam berapa studio ini terakhir menyentuh datanya.
revoke all on public.content_revision from anon, authenticated;
grant all on public.content_revision to service_role;
