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
