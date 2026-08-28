-- Dua perubahan yang diminta pemilik, keduanya HANYA menambah kolom.
--
-- Menambah, bukan mengganti: API yang sedang tayang tidak menyebut kolom
-- baru sama sekali, jadi migrasi ini bisa diterapkan lebih dulu tanpa
-- merusak apa pun — urutan yang diwajibkan CLAUDE.md setelah sekali
-- membuat produksi rusak.
--
-- Kolom lama (budget_range, timeline) sengaja TIDAK dihapus. Menghapusnya
-- akan langsung mematikan API yang masih tayang saat migrasi berjalan.
-- Membiarkannya kosong tidak merugikan siapa pun.

-- 1. Brief: anggaran jadi angka, target waktu jadi dua tanggal ----------
--
-- budget_amount bigint, bukan numeric: rupiah tidak punya pecahan yang
-- dipakai di sini, dan bigint memuat sampai sembilan kuadriliun — jauh di
-- atas nilai kontrak mana pun.
alter table public.project_briefs
  add column if not exists budget_amount bigint,
  add column if not exists start_date    date,
  add column if not exists end_date      date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_briefs_budget_amount_positif'
  ) then
    alter table public.project_briefs
      add constraint project_briefs_budget_amount_positif
      check (budget_amount is null or budget_amount >= 0);
  end if;

  -- Selesai tidak boleh mendahului mulai. Dijaga di database, bukan cuma di
  -- form: form bisa dilewati, database tidak.
  if not exists (
    select 1 from pg_constraint where conname = 'project_briefs_tanggal_berurutan'
  ) then
    alter table public.project_briefs
      add constraint project_briefs_tanggal_berurutan
      check (start_date is null or end_date is null or end_date >= start_date);
  end if;
end $$;

-- 2. Foto material menumpang tabel gambar yang sudah ada ----------------
--
-- Satu kolom pembeda, bukan tabel kedua: isinya identik (kunci penyimpanan,
-- keterangan, urutan) dan seluruh perkakas yang sudah ada — presigned
-- upload, penghapusan ikut proyek, indeks urutan — langsung berlaku.
-- Tabel kedua berarti menyalin semuanya dan merawat dua salinan.
--
-- default 'galeri' membuat seluruh baris lama tetap benar tanpa disentuh.
alter table public.project_images
  add column if not exists kind text not null default 'galeri';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_images_kind_sah'
  ) then
    alter table public.project_images
      add constraint project_images_kind_sah
      check (kind in ('galeri', 'material'));
  end if;
end $$;

-- Indeks lama (project_id, sort_order) tidak lagi cukup: tiap query kini
-- menyaring jenisnya juga, dan tanpa kind di indeks Postgres membaca
-- seluruh gambar proyek lalu membuang separuhnya.
create index if not exists project_images_jenis_idx
  on public.project_images (project_id, kind, sort_order);
