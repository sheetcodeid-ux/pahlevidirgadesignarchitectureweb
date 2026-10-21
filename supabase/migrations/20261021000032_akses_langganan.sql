-- Pengguna, paket langganan, mapping fitur, dan buku log audit.
--
-- Panel ini akan dijual berlangganan ke studio lain. Tiga peran:
--   admin     = OWNER. Semua fitur, tanpa batas waktu.
--   editor    = staf studio pemilik. Semua fitur kerja (seperti sekarang).
--   pelanggan = klien yang berlangganan. Hanya fitur yang dipetakan ke
--               paketnya, dan hanya selama masa aktifnya belum lewat.
--
-- TAHAP 1: datanya masih SATU studio. Akun pelanggan sudah bisa dibuat dan
-- diatur, tapi Worker API menolaknya masuk (var PELANGGAN_DIIZINKAN) sampai
-- pemisahan data per studio selesai — tanpa itu pelanggan melihat proyek dan
-- keuangan studio pemilik.
--
-- Ketiga tabel baru hanya disentuh Worker API (lewat Hyperdrive, melewati
-- RLS): RLS menyala tanpa policy dan tanpa grant untuk anon/authenticated,
-- persis seperti content_revision. Advisor Supabase karena itu akan
-- melaporkan rls_enabled_no_policy (INFO) untuk ketiganya — itu sengaja.

-- Paket langganan ---------------------------------------------------------
-- BUKAN service_tiers: itu paket JASA ARSITEK yang dijual studio ke kliennya.
-- Ini paket APLIKASI yang dijual pemilik ke studio lain.

create table public.access_plans (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (length(trim(name)) between 2 and 40),
  description text,
  -- Harga per bulan dalam rupiah. Kosong = belum ditentukan pemilik.
  price_month integer check (price_month is null or price_month >= 0),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger access_plans_touch before update on public.access_plans
  for each row execute function public.touch_updated_at();

-- Fitur = kunci lembar di panel (lihat apps/api/src/lib/fitur.ts). Kuncinya
-- teks, bukan enum: menambah halaman baru tidak boleh butuh migrasi.
create table public.plan_features (
  plan_id uuid not null references public.access_plans (id) on delete cascade,
  feature text not null check (feature ~ '^[a-z0-9-]{2,40}$'),
  primary key (plan_id, feature)
);

-- Profil: peran pelanggan + langganannya -----------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'editor', 'pelanggan'));

alter table public.profiles
  add column plan_id      uuid references public.access_plans (id) on delete set null,
  -- Masa aktif sampai tanggal ini (inklusif). Kosong = belum pernah dibayar.
  -- Diisi payment gateway saat pembayaran berhasil, atau pemilik secara
  -- manual. Tidak berarti apa pun untuk admin/editor.
  add column access_until date,
  -- Dinonaktifkan pemilik: tidak bisa masuk, apa pun paket dan masa aktifnya.
  add column is_suspended boolean not null default false,
  add column updated_at   timestamptz not null default now();

-- is_staff() dipakai policy RLS seluruh tabel konten. Pelanggan TIDAK boleh
-- ikut terhitung staf: di tahap 1 datanya milik studio pemilik.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor') and not is_suspended
  );
$$;

-- Buku log audit ------------------------------------------------------------
-- Ditulis Worker API untuk setiap perubahan dan setiap upaya masuk. Hanya
-- INSERT — tidak ada jalan mengubah atau menghapusnya dari panel.

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid references auth.users (id) on delete set null,
  -- Disalin, bukan cuma ditaut: akun yang dihapus tetap terbaca di log.
  actor_email text,
  actor_role  text,
  action      text not null check (action in ('masuk', 'gagal_masuk', 'keluar', 'buat', 'ubah', 'hapus', 'ditolak')),
  method      text,
  path        text,
  entity      text,
  entity_id   text,
  status      integer,
  -- {sebelum, sesudah, kiriman}; kata sandi dan token sudah dibuang.
  detail      jsonb,
  ip_hash     text,
  user_agent  text
);

create index audit_log_at_idx    on public.audit_log (at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, at desc);

-- Akses -------------------------------------------------------------------

alter table public.access_plans  enable row level security;
alter table public.plan_features enable row level security;
alter table public.audit_log     enable row level security;

revoke all on public.access_plans  from anon, authenticated;
revoke all on public.plan_features from anon, authenticated;
revoke all on public.audit_log     from anon, authenticated;
grant all on public.access_plans  to service_role;
grant all on public.plan_features to service_role;
grant all on public.audit_log     to service_role;

-- Isi awal: tiga paket dengan harga KOSONG — angkanya keputusan pemilik.
insert into public.access_plans (slug, name, description, sort_order) values
  ('dasar',  'Dasar',  'Proyek, tugas, dan relasi klien.',            1),
  ('studio', 'Studio', 'Dasar + keuangan proyek dan tagihan.',        2),
  ('pro',    'Pro',    'Semua fitur kerja, termasuk gaji dan KPI.',   3);

insert into public.plan_features (plan_id, feature)
select p.id, f.feature
from public.access_plans p
join (values
  ('dasar',  array['dashboard','tugas','pesan','proyek','portal-klien','direktori']),
  ('studio', array['dashboard','tugas','pesan','proyek','portal-klien','direktori',
                   'keuangan','terima','keluar','transaksi','tagihan','kas','tim','testimoni']),
  ('pro',    array['dashboard','tugas','pesan','proyek','portal-klien','direktori',
                   'keuangan','terima','keluar','transaksi','tagihan','kas','tim','testimoni',
                   'kpi','fee','gaji','bayaran-tim','aturan-fee'])
) as daftar (slug, fitur) on daftar.slug = p.slug
cross join lateral unnest(daftar.fitur) as f (feature);
