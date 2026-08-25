-- Direktori kontak lintas proyek: klien, kontraktor, dan supplier yang
-- dipakai berulang-ulang, terpisah dari team_members (yang khusus staf
-- tetap/freelancer yang bisa ditugaskan lewat List Kerjaan).
--
-- Tanpa tabel penghubung ke projects — studio ini ~7 klien per bulan, dan
-- riwayat "kontak ini pernah dipakai di proyek mana" belum pernah diminta.
-- Kalau kebutuhan itu muncul nanti, tabel penghubung baru dibuat saat itu.

create type public.contact_category as enum (
  'klien', 'kontraktor', 'supplier', 'lainnya'
);

create table public.directory_contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 2 and 160),
  category    public.contact_category not null default 'lainnya',
  company     text,
  phone       text,
  email       text,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index directory_contacts_category_idx on public.directory_contacts (category, name);

create trigger directory_contacts_touch_updated_at
  before update on public.directory_contacts
  for each row execute function public.touch_updated_at();

alter table public.directory_contacts enable row level security;

create policy "staf kelola direktori kontak"
  on public.directory_contacts for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.directory_contacts from anon, authenticated;
grant select, insert, update, delete on public.directory_contacts to authenticated;
grant all on public.directory_contacts to service_role;
