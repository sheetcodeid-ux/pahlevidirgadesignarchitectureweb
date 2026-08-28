-- Dokumen proyek: pesan suara dan metadata berkas.
--
-- Seperti migrasi sebelumnya, ini HANYA menambah kolom — API yang sedang
-- tayang tidak menyebut satupun di antaranya, jadi aman diterapkan lebih
-- dulu sesuai urutan yang diwajibkan CLAUDE.md.

-- 1. Pesan suara menumpang tabel dokumen, bukan tabel sendiri -------------
--
-- Alasannya sama dengan foto material: isinya identik (kunci penyimpanan,
-- urutan, thread komentar klien, hak akses lewat token progres) dan seluruh
-- perkakas yang sudah ada langsung berlaku. Yang beda cuma cara
-- menampilkannya — pemutar audio, bukan tautan "Lihat berkas".
--
-- default 'berkas' membuat seluruh baris lama tetap benar tanpa disentuh.
alter table public.project_documents
  add column if not exists kind text not null default 'berkas';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_documents_kind_sah'
  ) then
    alter table public.project_documents
      add constraint project_documents_kind_sah
      check (kind in ('berkas', 'suara'));
  end if;
end $$;

-- 2. Metadata berkas -----------------------------------------------------
--
-- Dibutuhkan sejak unggahan jadi banyak-berkas sekaligus: nama asli dipakai
-- sebagai judul otomatis (staf tidak mungkin mengetik judul satu per satu
-- untuk sepuluh berkas), ukuran ditampilkan ke klien supaya dia tahu apa
-- yang akan dia unduh, dan tipe menentukan berkas ini dibuka sebagai apa.
--
-- duration_ms hanya terisi untuk pesan suara: durasi harus tampil SEBELUM
-- audionya diunduh, dan satu-satunya pihak yang tahu durasinya tanpa
-- mengunduh adalah perekam di sisi staf.
alter table public.project_documents
  add column if not exists file_name   text,
  add column if not exists file_size   bigint,
  add column if not exists mime_type   text,
  add column if not exists duration_ms integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_documents_file_size_wajar'
  ) then
    -- 100 MB per berkas, angka yang sama yang dijaga di form dan di API.
    -- Dijaga di database juga karena form bisa dilewati, database tidak.
    alter table public.project_documents
      add constraint project_documents_file_size_wajar
      check (file_size is null or (file_size > 0 and file_size <= 104857600));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'project_documents_durasi_wajar'
  ) then
    alter table public.project_documents
      add constraint project_documents_durasi_wajar
      check (duration_ms is null or duration_ms > 0);
  end if;
end $$;
