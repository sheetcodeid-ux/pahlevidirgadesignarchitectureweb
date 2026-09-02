-- ============================================================================
-- BOOTSTRAP — tempel seluruh isi file ini ke SQL Editor Supabase, lalu Run.
--
-- File ini HASIL GENERATE dari supabase/migrations/ oleh
-- scripts/build-bootstrap.sh. Jangan disunting langsung.
--
-- Setelah dijalankan, seluruh migrasi juga dicatat di
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
-- 20260824000003_default_privileges.sql
-- ----------------------------------------------------------------------------

-- Menutup tabel masa depan secara bawaan.
--
-- Dua migrasi sebelumnya mencabut hak anon dan authenticated atas empat tabel
-- yang ada, lalu memberikannya kembali seperlunya. Tapi itu hanya berlaku
-- untuk tabel yang sudah ada saat itu. Tabel yang dibuat setelahnya kembali
-- mengikuti default privileges bawaan Supabase.
--
-- Migrasi ini membalik bawaannya: tabel baru di schema public tidak memberi
-- apa pun kepada anon maupun authenticated. Konsekuensinya disengaja — setiap
-- tabel baru jadi WAJIB disertai GRANT eksplisit, kalau tidak ia tidak akan
-- bisa dibaca siapa pun lewat PostgREST. Lebih baik gagal keras saat
-- pengembangan daripada tabel bocor diam-diam ke publik.
--
-- Tidak menyentuh tabel yang sudah ada; GRANT dari 20260818000002 tetap utuh.
-- Backend Go memakai service_role dan melewati semua ini.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 20260824000004_kunci_fungsi.sql
-- ----------------------------------------------------------------------------

-- Menutup dua celah yang ditemukan database linter Supabase setelah skema
-- terpasang di project sungguhan.
--
-- 1. is_staff() masih bisa dipanggil anon lewat /rest/v1/rpc/is_staff.
--
--    Migrasi 20260818000002 sudah menulis:
--      revoke execute on function public.is_staff() from anon, authenticated;
--    tapi itu tidak cukup. Postgres memberi EXECUTE kepada PUBLIC untuk setiap
--    fungsi baru, dan mencabut dari role bernama tidak menyentuh pemberian ke
--    PUBLIC. Jadi anon tetap boleh memanggilnya — lewat PUBLIC, bukan lewat
--    anon.
--
--    Ini bentuk yang sama persis dengan invarian keamanan #1 di CLAUDE.md,
--    hanya pindah dari tabel ke fungsi: mencabut dari role yang salah sambil
--    mengira pintunya sudah tertutup.
--
--    Dampaknya kecil — untuk anon, auth.uid() null sehingga fungsinya
--    mengembalikan false. Tapi ini fungsi security definer yang membaca
--    profiles, dan ia terbuka tanpa login. Ditutup.
--
--    Aman: seluruh policy yang memanggil is_staff() adalah `to authenticated`,
--    dan authenticated tetap punya EXECUTE eksplisit di bawah. anon tidak
--    pernah mengevaluasi policy itu.
--
-- 2. touch_updated_at() tidak mengunci search_path.
--
--    Fungsi trigger tanpa search_path tetap bisa dibelokkan kalau ada objek
--    bernama sama di schema lain yang lebih dulu ditemukan. Risikonya rendah
--    karena fungsinya security invoker dan hanya memanggil now(), tapi
--    menguncinya gratis.

revoke execute on function public.is_staff() from public;
grant  execute on function public.is_staff() to authenticated;

alter function public.touch_updated_at() set search_path = pg_catalog;

-- ----------------------------------------------------------------------------
-- 20260826000005_studio_settings_dan_progress.sql
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 20260827000006_pipeline_dan_tugas.sql
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 20260828000007_keuangan_proyek.sql
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 20260829000008_dokumen_proyek.sql
-- ----------------------------------------------------------------------------

-- Dokumen proyek yang bisa dilihat/diunduh klien lewat portal token, dan
-- bisa disetujui atau diminta revisi langsung dari sana.
--
-- Sama seperti project_progress: sengaja tidak ada policy anon. Baca dan
-- tulis dari sisi klien SELALU lewat endpoint backend yang memvalidasi
-- token secara eksplisit (koneksi backend melewati RLS) — bukan lewat
-- PostgREST langsung. RLS di sini menutup jalur langsung itu saja.
--
-- client_note menyimpan catatan revisi TERAKHIR, bukan riwayat berlapis —
-- linimasa percakapan penuh (Feedback & Approval lintas proyek) sengaja
-- ditunda ke fase berikutnya, supaya tabel ini tidak dibangun berlebihan
-- untuk kebutuhan yang belum pasti bentuknya.

create type public.document_status as enum (
  'draft', 'menunggu_klien', 'revisi_diminta', 'disetujui', 'final'
);

create table public.project_documents (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  title        text not null check (length(trim(title)) between 2 and 160),
  file_key     text not null,
  status       public.document_status not null default 'draft',
  client_note  text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index project_documents_project_idx on public.project_documents (project_id, sort_order);

create trigger project_documents_touch_updated_at
  before update on public.project_documents
  for each row execute function public.touch_updated_at();

alter table public.project_documents enable row level security;

create policy "staf kelola dokumen proyek"
  on public.project_documents for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.project_documents from anon, authenticated;
grant select, insert, update, delete on public.project_documents to authenticated;
grant all on public.project_documents to service_role;

-- ----------------------------------------------------------------------------
-- 20260830000009_direktori_kontak.sql
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 20260831000010_brief_feedback_testimoni.sql
-- ----------------------------------------------------------------------------

-- Tiga fitur terkait dari alur brief proyek sampai testimoni:
--
-- project_briefs: kebutuhan awal klien, satu baris per proyek (pola sama
-- dengan project_progress). Kolom yang klien isi terpisah dari
-- internal_notes yang staf-only — klien tidak pernah melihat catatan
-- internal staf tentang briefnya sendiri.
--
-- document_comments: linimasa percakapan berlapis per dokumen, menyusul
-- client_note tunggal di project_documents (sengaja ditunda ke fase ini,
-- lihat komentar di migrasi 20260829000008). client_note tunggal TETAP ada
-- untuk ringkasan cepat di daftar dokumen; komentar ini melengkapi dengan
-- riwayat penuh, bukan menggantikannya — mengubah project_documents.status
-- lewat approve/revise yang sudah ada tidak disentuh migrasi ini.
--
-- testimonials: berbeda dari dua tabel di atas — begitu disetujui staf,
-- testimoni memang untuk publik (ditampilkan di beranda), jadi anon diberi
-- SELECT eksplisit dengan RLS yang membatasi hanya baris berstatus
-- 'disetujui'. Pola ini sama seperti "publik baca proyek published" di
-- projects — bukan celah baru, mengikuti presenden yang sudah ada.

-- project_briefs ------------------------------------------------------

create table public.project_briefs (
  project_id       uuid primary key references public.projects (id) on delete cascade,
  budget_range     text,
  timeline         text,
  style_preference text,
  requirements     text,
  internal_notes   text,
  submitted_at     timestamptz,
  updated_at       timestamptz not null default now()
);

create trigger project_briefs_touch_updated_at
  before update on public.project_briefs
  for each row execute function public.touch_updated_at();

alter table public.project_briefs enable row level security;

create policy "staf kelola brief proyek"
  on public.project_briefs for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.project_briefs from anon, authenticated;
grant select, insert, update, delete on public.project_briefs to authenticated;
grant all on public.project_briefs to service_role;

-- document_comments -----------------------------------------------------

create type public.comment_author as enum ('staf', 'klien');

create table public.document_comments (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.project_documents (id) on delete cascade,
  author      public.comment_author not null,
  body        text not null check (length(trim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index document_comments_document_idx on public.document_comments (document_id, created_at);

alter table public.document_comments enable row level security;

create policy "staf kelola komentar dokumen"
  on public.document_comments for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.document_comments from anon, authenticated;
grant select, insert, update, delete on public.document_comments to authenticated;
grant all on public.document_comments to service_role;

-- testimonials ------------------------------------------------------------

create type public.testimonial_status as enum ('menunggu', 'disetujui', 'ditolak');

create table public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete set null,
  client_name text not null check (length(trim(client_name)) between 2 and 160),
  quote       text not null check (length(trim(quote)) between 2 and 2000),
  rating      smallint check (rating between 1 and 5),
  status      public.testimonial_status not null default 'menunggu',
  is_featured boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index testimonials_status_idx on public.testimonials (status, is_featured);

create trigger testimonials_touch_updated_at
  before update on public.testimonials
  for each row execute function public.touch_updated_at();

alter table public.testimonials enable row level security;

create policy "publik baca testimoni disetujui"
  on public.testimonials for select
  to anon, authenticated
  using (status = 'disetujui');

create policy "staf kelola testimoni"
  on public.testimonials for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.testimonials from anon, authenticated;
grant select                         on public.testimonials to anon;
grant select, insert, update, delete on public.testimonials to authenticated;
grant all                            on public.testimonials to service_role;

-- ----------------------------------------------------------------------------
-- 20260901000011_studio_logo.sql
-- ----------------------------------------------------------------------------

-- Logo studio, diunggah lewat panel Info Studio dan disimpan di R2 (bukan
-- Supabase Storage, konsisten dengan seluruh gambar lain di aplikasi ini).
-- Kolom baru di tabel yang sudah ada — GRANT tabel di migrasi
-- 20260826000005 (select untuk anon, select+update untuk authenticated)
-- otomatis mencakupnya, tidak perlu GRANT baru.

alter table public.studio_settings
  add column logo_key text;

-- ----------------------------------------------------------------------------
-- 20260902000012_zona_waktu_studio.sql
-- ----------------------------------------------------------------------------

-- Zona waktu studio, dipilih di panel Info Studio dan dipakai topbar admin
-- untuk menampilkan jam serta tanggal setempat.
--
-- Disimpan sebagai nama zona IANA (Asia/Jakarta / Asia/Makassar / Asia/Jayapura),
-- bukan singkatan WIB/WITA/WIT. Singkatan itu label untuk manusia; yang bisa
-- dipakai Intl.DateTimeFormat untuk benar-benar menghitung waktu adalah nama
-- IANA-nya. Menyimpan singkatannya berarti memetakan ulang di setiap tempat
-- yang membutuhkannya.
--
-- Kolom baru di tabel yang sudah ada — GRANT tabel di migrasi 20260826000005
-- (select untuk anon, select+update untuk authenticated) otomatis mencakupnya,
-- tidak perlu GRANT baru.

alter table public.studio_settings
  add column timezone text not null default 'Asia/Jakarta';

-- Nilainya dibatasi ke tiga zona Indonesia. Zona bebas akan membuat topbar
-- menampilkan waktu yang tidak pernah dimaksudkan siapa pun kalau ada salah
-- ketik, dan studio ini hanya beroperasi di Indonesia.
alter table public.studio_settings
  add constraint studio_settings_timezone_valid
  check (timezone in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'));

-- ----------------------------------------------------------------------------
-- 20260903000013_brief_tanggal_dan_foto_material.sql
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 20260904000014_dokumen_suara_dan_berkas.sql
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 20260905000015_cabut_execute_public.sql
-- ----------------------------------------------------------------------------

-- Menutup EXECUTE yang diberikan Postgres kepada PUBLIC.
--
-- Jebakan yang persis sama sudah tercatat di CLAUDE.md dan pernah menggigit
-- sekali di is_staff(): Postgres memberi `execute` pada fungsi baru kepada
-- **PUBLIC**, bukan kepada `anon`. Mencabut dari `anon` tidak menutup apa
-- pun. Migrasi 20260824000004 memperbaiki is_staff() tapi tidak menyentuh
-- fungsi lain, dan sisanya lolos.
--
-- is_staff() sengaja TIDAK disentuh di sini. Haknya sudah benar (postgres +
-- authenticated saja), dan `authenticated` memang harus bisa memanggilnya:
-- kebijakan RLS-lah yang memanggil fungsi itu.

-- 1. touch_updated_at() — milik kita sendiri --------------------------------
--
-- Fungsi trigger; mengembalikan tipe `trigger`, jadi PostgREST tidak bisa
-- memanggilnya sebagai RPC sama sekali. Tetap dicabut: permukaan yang tidak
-- dipakai siapa pun tidak punya alasan untuk tetap terbuka.
revoke execute on function public.touch_updated_at() from public;
revoke execute on function public.touch_updated_at() from anon, authenticated;

-- 2. rls_auto_enable() — milik platform Supabase ----------------------------
--
-- Bukan buatan kita: Supabase yang membuatnya di proyek terkelola, jadi ia
-- TIDAK ada di database Postgres polos tempat migrasi ini diuji. Karena itu
-- dibungkus pemeriksaan keberadaan — tanpa itu seluruh migrasi gagal di
-- mesin lokal dan bootstrap.sql ikut rusak.
--
-- Yang ditandai advisor: fungsinya SECURITY DEFINER dan terbuka untuk anon
-- lewat /rest/v1/rpc/. Dampak sebenarnya kecil — ia mengembalikan tipe
-- event_trigger dan menolak dijalankan di luar konteks event trigger — tapi
-- aturannya sudah jelas dan ini satu baris.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public';
    execute 'revoke execute on function public.rls_auto_enable() from anon, authenticated';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 20260906000016_tanggal_biaya.sql
-- ----------------------------------------------------------------------------

-- Tanggal biaya benar-benar terjadi, terpisah dari kapan ia diketik.
--
-- Analisis bulanan menjumlahkan biaya per bulan. Tanpa kolom ini yang bisa
-- dipakai cuma created_at — yaitu kapan stafnya MENGETIK, bukan kapan uangnya
-- keluar. Satu sore mengetik nota tiga bulan ke belakang akan menumpuk
-- semuanya ke bulan ini, dan grafiknya berbohong tanpa ada yang tahu.
--
-- Kas masuk tidak butuh kolom baru: invoices.paid_at sudah ada sejak awal.

alter table public.project_costs
  add column incurred_on date not null default current_date;

-- Baris lama memakai tanggal ketiknya sendiri — itu satu-satunya tanggal yang
-- pernah diketahui untuk mereka, dan menebak yang lain lebih buruk daripada
-- memakai yang ada.
update public.project_costs set incurred_on = created_at::date;

comment on column public.project_costs.incurred_on is
  'Tanggal biaya benar-benar terjadi. Dipakai analisis bulanan; created_at hanya mencatat kapan barisnya diketik.';

-- Analisis bulanan menyapu seluruh tabel per rentang tanggal, bukan per proyek.
create index project_costs_incurred_idx on public.project_costs (incurred_on);

-- Kas masuk bulanan menyaring invoice lunas per tanggal bayar.
create index invoices_paid_idx on public.invoices (paid_at) where status = 'lunas';

-- ----------------------------------------------------------------------------
-- Catat di riwayat migrasi Supabase
-- ----------------------------------------------------------------------------
--
-- Kolomnya mengikuti tabel bawaan Supabase CLI. Versi awal skrip ini hanya
-- membuat kolom `version`, dan itu membuat dashboard maupun tooling Supabase
-- gagal membaca riwayat migrasi dengan error "column name does not exist".

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);

alter table supabase_migrations.schema_migrations
  add column if not exists statements text[],
  add column if not exists name       text;

insert into supabase_migrations.schema_migrations (version, name) values
  ('20260818000001', 'init_schema'),
  ('20260818000002', 'rls_policies'),
  ('20260824000003', 'default_privileges'),
  ('20260824000004', 'kunci_fungsi'),
  ('20260826000005', 'studio_settings_dan_progress'),
  ('20260827000006', 'pipeline_dan_tugas'),
  ('20260828000007', 'keuangan_proyek'),
  ('20260829000008', 'dokumen_proyek'),
  ('20260830000009', 'direktori_kontak'),
  ('20260831000010', 'brief_feedback_testimoni'),
  ('20260901000011', 'studio_logo'),
  ('20260902000012', 'zona_waktu_studio'),
  ('20260903000013', 'brief_tanggal_dan_foto_material'),
  ('20260904000014', 'dokumen_suara_dan_berkas'),
  ('20260905000015', 'cabut_execute_public'),
  ('20260906000016', 'tanggal_biaya')
on conflict (version) do update set name = excluded.name;

commit;
