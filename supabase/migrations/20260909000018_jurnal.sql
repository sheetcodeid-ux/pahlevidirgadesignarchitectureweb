-- Jurnal studio: tulisan publik yang ditulis staf dari panel admin.
--
-- Polanya menyalin public.testimonials, bukan menciptakan pola baru: anon
-- diberi SELECT eksplisit dengan RLS yang membatasi hanya baris yang BENAR-
-- BENAR terbit, staf mengelola lewat is_staff(). Presedennya "publik baca
-- proyek published" di projects.
--
-- Isinya disimpan sebagai MARKDOWN, bukan HTML. Dua alasan: yang mengetik
-- pemilik sendiri di panel admin, dan HTML dari isian bebas berarti tiap
-- render harus dibersihkan lebih dulu. Markdown dirender saat build oleh
-- @astrojs/markdown-remark, yang sekalian membuat id tiap heading — dan dari
-- id itulah daftar isi di rancangan yang di-ACC diturunkan, tanpa mengurai
-- sendiri.

create type public.journal_category as enum ('site', 'money', 'permit', 'build');

create table public.journal_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 120),
  title        text not null check (length(trim(title)) between 3 and 200),
  -- Kalimat pembuka yang tampil di indeks DAN di kop tulisan. Satu kolom,
  -- bukan dua: dua salinan pasti menyimpang, dan itu bug yang sudah memakan
  -- berjam-jam di tempat lain di proyek ini.
  excerpt      text not null check (length(trim(excerpt)) between 10 and 600),
  body         text,
  category     public.journal_category not null default 'site',
  -- Perkiraan lama baca. Diisi staf, bukan dihitung: hitungan otomatis dari
  -- jumlah kata meleset jauh untuk tulisan yang penuh daftar dan gambar.
  read_minutes smallint not null default 5 check (read_minutes between 1 and 90),
  -- published_at NULL = "RENCANA" di indeks. Rancangan yang di-ACC memang
  -- menampilkan tulisan yang belum ditulis sebagai rencana bertanda tegas,
  -- supaya indeksnya jujur alih-alih diisi judul palsu yang tidak bisa dibuka.
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Yang sudah terbit WAJIB punya isi. Tanpa ini satu klik "terbitkan" pada
  -- draf kosong menayangkan halaman kosong yang langsung terindeks mesin
  -- pencari.
  constraint terbit_wajib_berisi
    check (published_at is null or length(trim(coalesce(body, ''))) >= 200)
);

create index journal_posts_publik_idx
  on public.journal_posts (published_at desc nulls last, category);

create trigger journal_posts_touch_updated_at
  before update on public.journal_posts
  for each row execute function public.touch_updated_at();

alter table public.journal_posts enable row level security;

-- Baris berencana (published_at null) dan yang tanggalnya masih di depan
-- TIDAK boleh terbaca anon. Tanpa syarat <= now(), tulisan yang dijadwalkan
-- sudah bisa dibaca siapa pun sejak detik disimpan.
create policy "publik baca tulisan terbit"
  on public.journal_posts for select
  to anon, authenticated
  using (published_at is not null and published_at <= now());

create policy "staf kelola tulisan"
  on public.journal_posts for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.journal_posts from anon, authenticated;
grant select                         on public.journal_posts to anon;
grant select, insert, update, delete on public.journal_posts to authenticated;
grant all                            on public.journal_posts to service_role;
