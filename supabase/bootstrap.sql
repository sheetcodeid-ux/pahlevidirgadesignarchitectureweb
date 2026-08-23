-- ============================================================================
-- BOOTSTRAP — tempel seluruh isi file ini ke SQL Editor Supabase, lalu Run.
--
-- File ini HASIL GENERATE dari supabase/migrations/ oleh
-- scripts/build-bootstrap.sh. Jangan disunting langsung.
--
-- Setelah dijalankan, kedua migrasi juga dicatat di
-- supabase_migrations.schema_migrations, sehingga `supabase db push` maupun
-- integrasi GitHub Supabase tahu skema ini sudah terpasang dan tidak mencoba
-- menerapkannya ulang.
-- ============================================================================

begin;

-- Berhenti kalau skema sudah ada, daripada gagal separuh jalan dengan pesan
-- "type already exists" yang membingungkan.
do $bootstrap$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'projects'
  ) then
    raise exception
      'Skema sudah terpasang. Kalau ingin memulai dari nol, hapus dulu tabel projects, project_images, inquiries, dan profiles.';
  end if;
end;
$bootstrap$;

-- ----------------------------------------------------------------------------
-- 20260818000001_init_schema.sql
-- ----------------------------------------------------------------------------

-- Skema inti untuk website studio arsitektur.
-- Dijalankan lewat: supabase db push

create extension if not exists pgcrypto;

-- Enum -----------------------------------------------------------------

create type public.project_category as enum (
  'residential', 'commercial', 'interior', 'landscape', 'masterplan', 'renovation'
);

create type public.project_status as enum ('draft', 'published', 'archived');

create type public.inquiry_status as enum ('new', 'contacted', 'qualified', 'closed');

-- Staf studio yang boleh mengelola konten. Baris dibuat manual setelah
-- user diundang lewat Supabase Auth; tidak ada self-signup.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  role       text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

-- Proyek ---------------------------------------------------------------

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  subtitle        text,
  summary         text,
  description     text,
  category        public.project_category not null default 'residential',
  status          public.project_status   not null default 'draft',
  location        text,
  city            text,
  year            smallint check (year between 1900 and 2100),
  client          text,
  area_sqm        numeric(10, 2) check (area_sqm > 0),
  lead_architect  text,
  cover_image_key text,
  is_featured     boolean not null default false,
  sort_order      integer not null default 0,
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Proyek published wajib punya cover, kalau tidak grid portfolio bolong.
  constraint published_needs_cover
    check (status <> 'published' or cover_image_key is not null)
);

create index projects_public_listing_idx
  on public.projects (status, published_at desc nulls last);
create index projects_category_idx on public.projects (category) where status = 'published';
create index projects_featured_idx on public.projects (sort_order) where is_featured;

-- Galeri gambar per proyek. `storage_key` menunjuk ke object di R2,
-- bukan URL penuh, supaya domain CDN bisa diganti tanpa migrasi data.
create table public.project_images (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  storage_key   text not null,
  alt_text      text,
  caption       text,
  width         integer check (width > 0),
  height        integer check (height > 0),
  blur_data_url text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index project_images_project_idx on public.project_images (project_id, sort_order);

-- Form kontak ----------------------------------------------------------

create table public.inquiries (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 2 and 120),
  email        text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone        text,
  project_type public.project_category,
  budget_range text,
  message      text not null check (length(trim(message)) between 10 and 5000),
  status       public.inquiry_status not null default 'new',
  source       text,
  ip_hash      text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index inquiries_triage_idx on public.inquiries (status, created_at desc);

-- updated_at otomatis --------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 20260818000002_rls_policies.sql
-- ----------------------------------------------------------------------------

-- Row Level Security.
--
-- Model akses:
--   anon           -> hanya baca proyek yang sudah published
--   authenticated  -> staf studio (ada barisnya di public.profiles), akses penuh konten
--   service_role   -> dipakai backend Go, melewati RLS (mis. simpan inquiry)

alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.project_images enable row level security;
alter table public.inquiries      enable row level security;

-- Helper. security definer supaya tidak rekursif ke policy profiles sendiri.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

revoke execute on function public.is_staff() from anon, authenticated;
grant execute on function public.is_staff() to authenticated;

-- profiles -------------------------------------------------------------

create policy "staf baca profil sendiri"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- projects -------------------------------------------------------------

create policy "publik baca proyek published"
  on public.projects for select
  to anon, authenticated
  using (status = 'published');

create policy "staf baca semua proyek"
  on public.projects for select
  to authenticated
  using (public.is_staff());

create policy "staf kelola proyek"
  on public.projects for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- project_images -------------------------------------------------------

create policy "publik baca gambar proyek published"
  on public.project_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_images.project_id
        and p.status = 'published'
    )
  );

create policy "staf kelola gambar proyek"
  on public.project_images for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- inquiries ------------------------------------------------------------
--
-- Sengaja TIDAK ada policy insert untuk anon. Form kontak masuk lewat API Go
-- yang memakai service_role, supaya validasi Turnstile + rate limit tidak bisa
-- dilewati dengan memanggil PostgREST langsung.

create policy "staf baca inquiry"
  on public.inquiries for select
  to authenticated
  using (public.is_staff());

create policy "staf update status inquiry"
  on public.inquiries for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Hak akses tabel -------------------------------------------------------
--
-- RLS hanya menyaring BARIS; yang menentukan sebuah role boleh menyentuh
-- tabel sama sekali adalah GRANT. Supabase memasang default privileges yang
-- memberi `all` atas tabel baru di schema public kepada anon dan
-- authenticated, jadi tanpa blok ini anon punya hak INSERT/UPDATE/DELETE
-- atas seluruh tabel dan satu-satunya penjaga adalah policy RLS.
--
-- Dicabut dulu, lalu diberikan seperlunya, supaya hasil akhirnya tidak
-- bergantung pada bawaan Supabase yang bisa berubah.

revoke all on public.profiles       from anon, authenticated;
revoke all on public.projects       from anon, authenticated;
revoke all on public.project_images from anon, authenticated;
revoke all on public.inquiries      from anon, authenticated;

-- Pengunjung: baca saja, dan RLS membatasi ke baris published.
grant select on public.projects       to anon;
grant select on public.project_images to anon;

-- Staf studio: kelola konten. Policy is_staff() yang memutuskan siapa yang
-- benar-benar lolos.
grant select                         on public.profiles       to authenticated;
grant select, insert, update, delete on public.projects       to authenticated;
grant select, insert, update, delete on public.project_images to authenticated;

-- Inquiry: staf boleh membaca dan mengubah status, tapi tidak boleh membuat
-- atau menghapus. Penulisan hanya lewat backend Go dengan service_role.
grant select, update on public.inquiries to authenticated;

-- anon tidak diberi hak apa pun atas inquiries — sengaja, agar form kontak
-- tidak bisa dilewati dengan memanggil PostgREST langsung.

grant all on public.profiles       to service_role;
grant all on public.projects       to service_role;
grant all on public.project_images to service_role;
grant all on public.inquiries      to service_role;

-- ----------------------------------------------------------------------------
-- Catat di riwayat migrasi Supabase
-- ----------------------------------------------------------------------------

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key
);

insert into supabase_migrations.schema_migrations (version)
values ('20260818000001'), ('20260818000002')
on conflict (version) do nothing;

commit;
