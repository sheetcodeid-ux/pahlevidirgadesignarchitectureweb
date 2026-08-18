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
