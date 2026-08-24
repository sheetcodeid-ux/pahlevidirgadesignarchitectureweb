-- Tes RLS. Jalankan dengan koneksi superuser (postgres):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
--
-- Seluruh isinya dibungkus transaksi yang di-rollback, jadi aman dijalankan
-- terhadap database yang sudah berisi data.
--
-- Yang diuji bukan cuma policy, tapi juga GRANT: RLS menyaring baris,
-- sementara GRANT yang menentukan sebuah role boleh menyentuh tabelnya sama
-- sekali. Keduanya harus benar.

begin;

\set STAF   'aaaa0000-0000-4000-8000-000000000001'
\set LUAR   'bbbb0000-0000-4000-8000-000000000002'

-- Fixture ---------------------------------------------------------------
--
-- Bersihkan dulu kalau ada sisa dari run sebelumnya yang terputus. Semuanya
-- tetap di dalam transaksi yang di-rollback.
delete from auth.users where id in (:'STAF', :'LUAR');

insert into auth.users (id, email, instance_id, aud, role)
values (:'STAF', 'tes-staf@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
       (:'LUAR', 'tes-luar@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into public.profiles (id, full_name, role) values (:'STAF', 'Staf Tes', 'admin');

insert into public.projects (slug, title, status, cover_image_key, published_at)
values ('tes-published', 'Proyek Tes Published', 'published', 'tes/cover.jpg', now()),
       ('tes-draft',     'Proyek Tes Draft',     'draft',     null,            null);

insert into public.project_images (project_id, storage_key)
select id, 'tes/rahasia.jpg' from public.projects where slug = 'tes-draft';

-- Helper ----------------------------------------------------------------

create or replace function pg_temp.jadi_anon() returns void language plpgsql as $$
begin
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

create or replace function pg_temp.jadi_user(uid text) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', uid, true);
end;
$$;

create or replace function pg_temp.tolak(gagal boolean, pesan text) returns void language plpgsql as $$
begin
  if gagal then
    raise exception 'GAGAL: %', pesan;
  end if;
  raise notice 'ok: %', pesan;
end;
$$;

-- Pengunjung anonim -----------------------------------------------------

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_anon();

  select count(*) into terlihat from public.projects where slug like 'tes-%';
  perform pg_temp.tolak(terlihat <> 1, 'anon hanya melihat proyek published');

  select count(*) into terlihat from public.project_images where storage_key = 'tes/rahasia.jpg';
  perform pg_temp.tolak(terlihat <> 0, 'anon tidak melihat gambar proyek draft');

  reset role;
end;
$$;

do $$
begin
  perform pg_temp.jadi_anon();
  begin
    insert into public.inquiries (name, email, message)
    values ('Bot', 'bot@spam.example', 'pesan spam yang cukup panjang');
    raise exception 'GAGAL: anon berhasil menulis inquiry langsung ke tabel';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak menulis inquiry (harus lewat backend Go)';
  end;
  reset role;
end;
$$;

do $$
begin
  perform pg_temp.jadi_anon();
  begin
    update public.projects set title = 'diretas' where slug = 'tes-published';
    raise exception 'GAGAL: anon berhasil mengubah proyek';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak mengubah proyek';
  end;
  reset role;
end;
$$;

-- User login yang bukan staf --------------------------------------------

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  select count(*) into terlihat from public.projects where slug like 'tes-%';
  perform pg_temp.tolak(terlihat <> 1, 'non-staf hanya melihat proyek published');

  select count(*) into terlihat from public.inquiries;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun inquiry');

  begin
    insert into public.projects (slug, title) values ('tes-nakal', 'Nakal');
    raise exception 'GAGAL: non-staf berhasil membuat proyek';
  exception when insufficient_privilege then
    raise notice 'ok: non-staf ditolak membuat proyek';
  end;

  reset role;
end;
$$;

-- Staf studio -----------------------------------------------------------

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');

  select count(*) into terlihat from public.projects where slug like 'tes-%';
  perform pg_temp.tolak(terlihat <> 2, 'staf melihat proyek draft dan published');

  insert into public.projects (slug, title) values ('tes-buatan-staf', 'Buatan Staf');
  perform pg_temp.tolak(false, 'staf dapat membuat proyek');

  begin
    insert into public.inquiries (name, email, message)
    values ('Staf', 'staf@example.com', 'coba tembus lewat akun staf');
    raise exception 'GAGAL: staf berhasil membuat inquiry';
  exception when insufficient_privilege then
    raise notice 'ok: staf pun tidak bisa membuat inquiry';
  end;

  reset role;
end;
$$;

-- Constraint ------------------------------------------------------------

do $$
begin
  begin
    update public.projects set status = 'published' where slug = 'tes-draft';
    raise exception 'GAGAL: proyek tanpa cover bisa dipublikasikan';
  exception when check_violation then
    raise notice 'ok: proyek published wajib punya cover';
  end;
end;
$$;

-- Hak eksekusi fungsi ---------------------------------------------------
--
-- is_staff() adalah security definer yang membaca profiles. Postgres memberi
-- EXECUTE kepada PUBLIC untuk setiap fungsi baru, dan mencabut dari role
-- bernama (anon, authenticated) tidak menyentuh pemberian ke PUBLIC — jadi
-- pernah ada masa fungsinya terbuka lewat /rest/v1/rpc/is_staff tanpa login.
-- Bentuk keliru yang sama dengan hak tabel, hanya pindah objek.

do $$
begin
  perform pg_temp.jadi_anon();
  begin
    perform public.is_staff();
    raise exception 'GAGAL: anon boleh memanggil is_staff()';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak memanggil is_staff()';
  end;
  reset role;
end;
$$;

-- Bawaan tabel baru -----------------------------------------------------
--
-- Menjaga migrasi 20260824000003. Tabel yang dibuat tanpa GRANT eksplisit
-- harus tertutup, supaya tabel baru tidak pernah bocor karena lupa.

do $$
declare hak int;
begin
  create table public.tes_bawaan_tertutup (id int);

  select count(*) into hak
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'tes_bawaan_tertutup'
    and grantee in ('anon', 'authenticated');

  perform pg_temp.tolak(hak <> 0,
    'tabel baru tidak memberi hak apa pun kepada anon/authenticated');

  drop table public.tes_bawaan_tertutup;
end;
$$;

rollback;
