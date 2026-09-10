-- Shim untuk MENJALANKAN rls_test.sql di Postgres lokal.
--
-- Bukan bagian dari skema produksi dan TIDAK boleh masuk supabase/migrations/:
-- di Supabase, skema `auth` dan ketiga peran ini sudah disediakan platformnya.
-- Berkas ini cuma membuat bentuk seminimal mungkin yang dipakai bootstrap.sql
-- dan rls_test.sql, supaya tes RLS bisa benar-benar dijalankan di sini alih-alih
-- cuma dibaca.
--
-- Yang ditiru hanya tiga hal: peran anon/authenticated/service_role,
-- tabel auth.users, dan fungsi auth.uid() yang membaca klaim JWT dari
-- setelan sesi — persis cara Supabase melakukannya.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id          uuid primary key,
  email       text,
  instance_id uuid,
  aud         text,
  role        text
);

-- Supabase mengambil subjek JWT dari request.jwt.claim.sub (atau dari klaim
-- lengkap di request.jwt.claims). Yang dipakai rls_test.sql yang pertama.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
