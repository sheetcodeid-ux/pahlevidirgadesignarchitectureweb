-- Dua fitur baru: info studio yang bisa diedit dari admin, dan progres
-- proyek yang bisa dilihat klien lewat link token — tanpa akun klien.
--
-- studio_settings: singleton (selalu satu baris) berisi info yang tadinya
-- hardcode di Footer.astro. Publik boleh membacanya (sama seperti nama dan
-- kontak di kartu nama), staf yang boleh mengubah.
--
-- project_progress + project_progress_updates: fase konstruksi dan linimasa
-- catatan per proyek. Sengaja TIDAK ada policy anon sama sekali — pola yang
-- sama dengan inquiries. Akses publik (klien) HANYA lewat endpoint API yang
-- memvalidasi access_token secara eksplisit di kode, memakai koneksi backend
-- yang melewati RLS. RLS di sini menutup jalur PostgREST langsung, supaya
-- token acak project_progress tidak pernah terekspos lewat kolom biasa di
-- tabel projects yang sudah anon-readable untuk proyek published.

create type public.project_phase as enum (
  'konsultasi', 'konsep', 'ded', 'perizinan', 'konstruksi', 'selesai'
);

-- studio_settings -----------------------------------------------------

create table public.studio_settings (
  id            boolean primary key default true,
  studio_name   text not null default 'Dirga Pahlevi Architecture',
  tagline       text,
  email         text,
  phone         text,
  address       text,
  city          text,
  instagram_url text,
  updated_at    timestamptz not null default now(),

  constraint studio_settings_singleton check (id)
);

insert into public.studio_settings (id, studio_name, email, city)
values (true, 'Dirga Pahlevi Architecture', 'studio@pahlevidirgaarchitecture.com', 'Pontianak');

create trigger studio_settings_touch_updated_at
  before update on public.studio_settings
  for each row execute function public.touch_updated_at();

alter table public.studio_settings enable row level security;

create policy "publik baca info studio"
  on public.studio_settings for select
  to anon, authenticated
  using (true);

create policy "staf ubah info studio"
  on public.studio_settings for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.studio_settings from anon, authenticated;
grant select           on public.studio_settings to anon;
grant select, update   on public.studio_settings to authenticated;
grant all               on public.studio_settings to service_role;

-- project_progress ------------------------------------------------------

create table public.project_progress (
  project_id   uuid primary key references public.projects (id) on delete cascade,
  phase        public.project_phase not null default 'konsultasi',
  -- Token acak 20-byte (40 karakter hex) — dipakai di URL publik /progres/:token.
  -- Bukan kolom di tabel projects yang sudah anon-readable, supaya tidak
  -- pernah ikut terekspos lewat select biasa atas proyek published.
  access_token text not null unique default encode(gen_random_bytes(20), 'hex'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger project_progress_touch_updated_at
  before update on public.project_progress
  for each row execute function public.touch_updated_at();

create table public.project_progress_updates (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title      text not null check (length(trim(title)) between 2 and 160),
  note       text,
  photo_key  text,
  created_at timestamptz not null default now()
);

create index project_progress_updates_project_idx
  on public.project_progress_updates (project_id, created_at desc);

alter table public.project_progress         enable row level security;
alter table public.project_progress_updates enable row level security;

-- Sengaja tidak ada policy untuk anon di kedua tabel ini.

create policy "staf kelola progress proyek"
  on public.project_progress for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staf kelola catatan progress"
  on public.project_progress_updates for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.project_progress         from anon, authenticated;
revoke all on public.project_progress_updates from anon, authenticated;

grant select, insert, update, delete on public.project_progress         to authenticated;
grant select, insert, update, delete on public.project_progress_updates to authenticated;

grant all on public.project_progress         to service_role;
grant all on public.project_progress_updates to service_role;
