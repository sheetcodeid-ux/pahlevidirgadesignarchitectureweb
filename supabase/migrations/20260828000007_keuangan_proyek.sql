-- Keuangan studio: nilai kontrak, invoice (DP/pelunasan), dan biaya (HPP)
-- per proyek. Margin dihitung di aplikasi dari tiga angka ini
-- (kontrak - total biaya), bukan disimpan sebagai kolom — supaya tidak
-- pernah tidak sinkron dengan invoice/biaya yang sebenarnya.
--
-- Sama seperti project_tasks dan project_progress: murni data internal,
-- sengaja tidak ada policy anon sama sekali. Klien tidak pernah melihat
-- angka keuangan lewat jalur mana pun di fase ini.

create type public.invoice_status as enum ('draft', 'terbit', 'lunas');
create type public.cost_category as enum ('freelancer', 'operasional', 'prinsipal', 'lainnya');

alter table public.projects
  add column contract_value numeric(14, 2) check (contract_value > 0);

-- invoices ----------------------------------------------------------------

create table public.invoices (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label      text not null check (length(trim(label)) between 2 and 120),
  amount     numeric(14, 2) not null check (amount > 0),
  status     public.invoice_status not null default 'draft',
  due_date   date,
  paid_at    timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_project_idx on public.invoices (project_id, sort_order);
-- Piutang: invoice yang sudah terbit tapi belum lunas.
create index invoices_piutang_idx on public.invoices (due_date) where status = 'terbit';

create trigger invoices_touch_updated_at
  before update on public.invoices
  for each row execute function public.touch_updated_at();

alter table public.invoices enable row level security;

create policy "staf kelola invoice"
  on public.invoices for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.invoices from anon, authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;

-- project_costs (HPP) -------------------------------------------------------

create table public.project_costs (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label      text not null check (length(trim(label)) between 2 and 160),
  category   public.cost_category not null default 'lainnya',
  amount     numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index project_costs_project_idx on public.project_costs (project_id);

alter table public.project_costs enable row level security;

create policy "staf kelola biaya proyek"
  on public.project_costs for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.project_costs from anon, authenticated;
grant select, insert, update, delete on public.project_costs to authenticated;
grant all on public.project_costs to service_role;
