-- Alur operasional internal studio: tahap pipeline per proyek (penjualan
-- sampai pelunasan) dan daftar tugas per tahap.
--
-- Ini BEDA dari project_progress.phase (migrasi 20260826000005) — itu
-- fase konstruksi versi sederhana yang dilihat KLIEN lewat link token.
-- pipeline_stage di sini adalah tahap operasional INTERNAL studio
-- (termasuk penjualan/kontrak), dilihat staf saja, tidak pernah publik.
--
-- team_members sengaja terpisah dari profiles: profiles adalah akun
-- Supabase Auth yang bisa login (staf penginput konten), sedangkan
-- team_members adalah roster nama — termasuk freelancer yang membantu
-- produksi gambar tapi tidak pernah login ke panel admin sama sekali.

create type public.pipeline_stage as enum (
  'proposal', 'deal_kontrak', 'dp_50', 'desain_1', 'desain_2', 'finish', 'pelunasan'
);

alter table public.projects
  add column pipeline_stage public.pipeline_stage not null default 'proposal';

create type public.task_status as enum (
  'belum_mulai', 'berjalan', 'review_internal', 'menunggu_klien', 'selesai'
);

-- team_members ------------------------------------------------------------

create table public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 2 and 120),
  role       text,
  created_at timestamptz not null default now()
);

alter table public.team_members enable row level security;

create policy "staf kelola tim"
  on public.team_members for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.team_members from anon, authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;

-- project_tasks -------------------------------------------------------------

create table public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null check (length(trim(title)) between 2 and 200),
  stage       public.pipeline_stage,
  assignee_id uuid references public.team_members (id) on delete set null,
  status      public.task_status not null default 'belum_mulai',
  due_date    date,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index project_tasks_project_idx on public.project_tasks (project_id, sort_order);
create index project_tasks_status_idx  on public.project_tasks (status) where status <> 'selesai';

create trigger project_tasks_touch_updated_at
  before update on public.project_tasks
  for each row execute function public.touch_updated_at();

alter table public.project_tasks enable row level security;

-- Sengaja tidak ada policy anon — daftar tugas internal, tidak pernah tampil
-- di portal klien mana pun.

create policy "staf kelola tugas"
  on public.project_tasks for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.project_tasks from anon, authenticated;
grant select, insert, update, delete on public.project_tasks to authenticated;
grant all on public.project_tasks to service_role;
