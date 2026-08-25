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
