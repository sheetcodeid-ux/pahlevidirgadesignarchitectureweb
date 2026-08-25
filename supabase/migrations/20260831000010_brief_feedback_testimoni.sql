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
