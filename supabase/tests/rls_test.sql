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

-- studio_settings ---------------------------------------------------------

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_anon();

  select count(*) into terlihat from public.studio_settings;
  perform pg_temp.tolak(terlihat <> 1, 'anon boleh membaca info studio');

  begin
    update public.studio_settings set studio_name = 'diretas';
    raise exception 'GAGAL: anon berhasil mengubah info studio';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak mengubah info studio';
  end;

  reset role;
end;
$$;

-- Role authenticated punya GRANT UPDATE di level tabel, jadi RLS yang tidak
-- lolos tidak melempar error — ia memfilter baris secara diam (0 baris
-- terupdate). Beda dari kasus anon di atas yang memang tidak punya GRANT
-- sama sekali sehingga langsung ditolak di level tabel.
do $$
declare terkena int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  update public.studio_settings set studio_name = 'diretas';
  get diagnostics terkena = row_count;
  perform pg_temp.tolak(terkena <> 0, 'non-staf tidak bisa mengubah baris info studio (RLS memfilter, 0 baris)');

  reset role;
end;
$$;

do $$
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');
  update public.studio_settings set studio_name = 'Nama Baru';
  perform pg_temp.tolak(false, 'staf dapat mengubah info studio');
  reset role;
end;
$$;

-- project_progress & project_progress_updates ------------------------------
--
-- Sengaja tidak ada policy anon sama sekali di kedua tabel ini — akses klien
-- lewat token hanya boleh terjadi lewat backend, bukan PostgREST langsung.

do $$
declare pid uuid;
begin
  select id into pid from public.projects where slug = 'tes-published';
  insert into public.project_progress (project_id) values (pid);
  insert into public.project_progress_updates (project_id, title)
  values (pid, 'Fondasi selesai');
end;
$$;

-- anon tidak punya GRANT sama sekali di kedua tabel ini (bukan cuma
-- difilter RLS), jadi setiap percobaan langsung ditolak di level tabel.
do $$
begin
  perform pg_temp.jadi_anon();

  begin
    perform count(*) from public.project_progress;
    raise exception 'GAGAL: anon berhasil membaca project_progress';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca project_progress';
  end;

  begin
    perform count(*) from public.project_progress_updates;
    raise exception 'GAGAL: anon berhasil membaca catatan progress';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca catatan progress';
  end;

  begin
    insert into public.project_progress_updates (project_id, title)
    values ((select id from public.projects where slug = 'tes-published'), 'Nakal');
    raise exception 'GAGAL: anon berhasil menulis catatan progress';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak menulis catatan progress';
  end;

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  select count(*) into terlihat from public.project_progress;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun baris project_progress');

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');

  select count(*) into terlihat from public.project_progress;
  perform pg_temp.tolak(terlihat <> 1, 'staf melihat baris project_progress');

  insert into public.project_progress_updates (project_id, title)
  values ((select id from public.projects where slug = 'tes-published'), 'Catatan staf');
  perform pg_temp.tolak(false, 'staf dapat menambah catatan progress');

  reset role;
end;
$$;

-- team_members & project_tasks --------------------------------------------
--
-- Sama seperti project_progress: internal murni, tidak ada policy anon.

do $$
declare tid uuid; pid uuid;
begin
  insert into public.team_members (name, role) values ('Rian Saputra', 'Drafter DED') returning id into tid;
  select id into pid from public.projects where slug = 'tes-published';
  insert into public.project_tasks (project_id, title, assignee_id, stage)
  values (pid, 'Gambar kerja denah', tid, 'desain_1');
end;
$$;

do $$
begin
  perform pg_temp.jadi_anon();

  begin
    perform count(*) from public.team_members;
    raise exception 'GAGAL: anon berhasil membaca team_members';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca team_members';
  end;

  begin
    perform count(*) from public.project_tasks;
    raise exception 'GAGAL: anon berhasil membaca project_tasks';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca project_tasks';
  end;

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  select count(*) into terlihat from public.team_members;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun team_members');

  select count(*) into terlihat from public.project_tasks;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun project_tasks');

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');

  select count(*) into terlihat from public.team_members;
  perform pg_temp.tolak(terlihat <> 1, 'staf melihat team_members');

  select count(*) into terlihat from public.project_tasks;
  perform pg_temp.tolak(terlihat <> 1, 'staf melihat project_tasks');

  update public.project_tasks set status = 'selesai' where title = 'Gambar kerja denah';
  perform pg_temp.tolak(false, 'staf dapat mengubah status tugas');

  reset role;
end;
$$;

-- invoices & project_costs --------------------------------------------------
--
-- Sama seperti project_tasks: murni data internal, tidak ada policy anon.

do $$
declare pid uuid;
begin
  select id into pid from public.projects where slug = 'tes-published';
  insert into public.invoices (project_id, label, amount, status)
  values (pid, 'DP 50%', 34000000, 'lunas');
  insert into public.project_costs (project_id, label, category, amount)
  values (pid, 'Fee freelancer DED', 'freelancer', 7200000);
end;
$$;

do $$
begin
  perform pg_temp.jadi_anon();

  begin
    perform count(*) from public.invoices;
    raise exception 'GAGAL: anon berhasil membaca invoices';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca invoices';
  end;

  begin
    perform count(*) from public.project_costs;
    raise exception 'GAGAL: anon berhasil membaca project_costs';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca project_costs';
  end;

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  select count(*) into terlihat from public.invoices;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun invoice');

  select count(*) into terlihat from public.project_costs;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun biaya proyek');

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');

  select count(*) into terlihat from public.invoices;
  perform pg_temp.tolak(terlihat <> 1, 'staf melihat invoice');

  select count(*) into terlihat from public.project_costs;
  perform pg_temp.tolak(terlihat <> 1, 'staf melihat biaya proyek');

  update public.invoices set status = 'terbit' where label = 'DP 50%';
  perform pg_temp.tolak(false, 'staf dapat mengubah status invoice');

  reset role;
end;
$$;

-- project_documents -------------------------------------------------------
--
-- Sama seperti project_progress: murni data internal, tidak ada policy
-- anon. Klien membaca/menyetujui lewat endpoint backend, bukan tabel ini.

do $$
declare pid uuid;
begin
  select id into pid from public.projects where slug = 'tes-published';
  insert into public.project_documents (project_id, title, file_key, status)
  values (pid, 'DED Set A', 'documents/tes/ded-a.pdf', 'menunggu_klien');
end;
$$;

do $$
begin
  perform pg_temp.jadi_anon();

  begin
    perform count(*) from public.project_documents;
    raise exception 'GAGAL: anon berhasil membaca project_documents';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca project_documents';
  end;

  begin
    update public.project_documents set status = 'disetujui';
    raise exception 'GAGAL: anon berhasil mengubah project_documents';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak mengubah project_documents';
  end;

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  select count(*) into terlihat from public.project_documents;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun project_documents');

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');

  select count(*) into terlihat from public.project_documents;
  perform pg_temp.tolak(terlihat <> 1, 'staf melihat project_documents');

  update public.project_documents set status = 'disetujui' where title = 'DED Set A';
  perform pg_temp.tolak(false, 'staf dapat mengubah status dokumen');

  reset role;
end;
$$;

-- directory_contacts -------------------------------------------------------
--
-- Direktori klien/kontraktor/supplier: murni data internal, sama seperti
-- team_members — tidak ada alasan untuk anon atau non-staf menyentuhnya.

insert into public.directory_contacts (name, category, company, phone)
values ('Toko Bangunan Jaya', 'supplier', 'CV Jaya Makmur', '0812xxxxxxx');

do $$
begin
  perform pg_temp.jadi_anon();

  begin
    perform count(*) from public.directory_contacts;
    raise exception 'GAGAL: anon berhasil membaca directory_contacts';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca directory_contacts';
  end;

  begin
    update public.directory_contacts set name = 'diubah anon';
    raise exception 'GAGAL: anon berhasil mengubah directory_contacts';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak mengubah directory_contacts';
  end;

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  select count(*) into terlihat from public.directory_contacts;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun directory_contacts');

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');

  select count(*) into terlihat from public.directory_contacts;
  perform pg_temp.tolak(terlihat <> 1, 'staf melihat directory_contacts');

  update public.directory_contacts set note = 'dihubungi minggu ini' where name = 'Toko Bangunan Jaya';
  perform pg_temp.tolak(false, 'staf dapat mengubah catatan kontak');

  reset role;
end;
$$;

-- project_briefs ------------------------------------------------------
--
-- Sama seperti project_progress: murni data internal, tidak ada policy
-- anon. Klien mengisi lewat endpoint backend yang memvalidasi token.

do $$
declare pid uuid;
begin
  select id into pid from public.projects where slug = 'tes-published';
  insert into public.project_briefs (project_id, budget_range, requirements)
  values (pid, '50-100jt', 'Rumah 2 lantai, 3 kamar');
end;
$$;

do $$
begin
  perform pg_temp.jadi_anon();

  begin
    perform count(*) from public.project_briefs;
    raise exception 'GAGAL: anon berhasil membaca project_briefs';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca project_briefs';
  end;

  begin
    update public.project_briefs set budget_range = 'diubah anon';
    raise exception 'GAGAL: anon berhasil mengubah project_briefs';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak mengubah project_briefs';
  end;

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  select count(*) into terlihat from public.project_briefs;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun project_briefs');

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');

  select count(*) into terlihat from public.project_briefs;
  perform pg_temp.tolak(terlihat <> 1, 'staf melihat project_briefs');

  update public.project_briefs set internal_notes = 'sudah ditelepon' where budget_range = '50-100jt';
  perform pg_temp.tolak(false, 'staf dapat mengubah catatan internal brief');

  reset role;
end;
$$;

-- document_comments ---------------------------------------------------
--
-- Thread komentar per dokumen — pola akses sama dengan project_documents
-- induknya: murni internal, klien menulis lewat endpoint backend.

do $$
declare did uuid;
begin
  select id into did from public.project_documents where title = 'DED Set A';
  insert into public.document_comments (document_id, author, body)
  values (did, 'staf', 'Ini revisi pertama, mohon dicek bagian dapur.');
end;
$$;

do $$
begin
  perform pg_temp.jadi_anon();

  begin
    perform count(*) from public.document_comments;
    raise exception 'GAGAL: anon berhasil membaca document_comments';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak membaca document_comments';
  end;

  begin
    insert into public.document_comments (document_id, author, body)
    values ((select id from public.project_documents where title = 'DED Set A'), 'klien', 'anon nyelip');
    raise exception 'GAGAL: anon berhasil menulis document_comments';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak menulis document_comments';
  end;

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  select count(*) into terlihat from public.document_comments;
  perform pg_temp.tolak(terlihat <> 0, 'non-staf tidak melihat satu pun document_comments');

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');

  select count(*) into terlihat from public.document_comments;
  perform pg_temp.tolak(terlihat <> 1, 'staf melihat document_comments');

  insert into public.document_comments (document_id, author, body)
  values ((select id from public.project_documents where title = 'DED Set A'), 'staf', 'balasan staf');
  perform pg_temp.tolak(false, 'staf dapat menambah komentar dokumen');

  reset role;
end;
$$;

-- testimonials --------------------------------------------------------
--
-- Berbeda dari dua tabel di atas: begitu disetujui, testimoni untuk publik.
-- anon boleh SELECT tapi RLS membatasi hanya baris status='disetujui'.

insert into public.testimonials (client_name, quote, status)
values ('Bu Sinta', 'Prosesnya rapi dan hasilnya sesuai ekspektasi.', 'disetujui'),
       ('Pak Andi', 'Masih menunggu approval, jangan tampil dulu.', 'menunggu');

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_anon();

  select count(*) into terlihat from public.testimonials;
  perform pg_temp.tolak(terlihat <> 1, 'anon hanya melihat testimoni berstatus disetujui');

  begin
    insert into public.testimonials (client_name, quote) values ('anon', 'nyelip');
    raise exception 'GAGAL: anon berhasil menulis testimonials';
  exception when insufficient_privilege then
    raise notice 'ok: anon ditolak menulis testimonials';
  end;

  reset role;
end;
$$;

do $$
declare terlihat int;
declare terkena int;
begin
  perform pg_temp.jadi_user('bbbb0000-0000-4000-8000-000000000002');

  select count(*) into terlihat from public.testimonials;
  perform pg_temp.tolak(terlihat <> 1, 'non-staf hanya melihat testimoni berstatus disetujui, sama seperti anon');

  update public.testimonials set is_featured = true where client_name = 'Bu Sinta';
  get diagnostics terkena = row_count;
  perform pg_temp.tolak(terkena <> 0, 'non-staf tidak bisa mengubah testimoni (RLS memfilter, 0 baris)');

  reset role;
end;
$$;

do $$
declare terlihat int;
begin
  perform pg_temp.jadi_user('aaaa0000-0000-4000-8000-000000000001');

  select count(*) into terlihat from public.testimonials;
  perform pg_temp.tolak(terlihat <> 2, 'staf melihat seluruh testimoni termasuk yang menunggu');

  update public.testimonials set status = 'disetujui', is_featured = true where client_name = 'Pak Andi';
  perform pg_temp.tolak(false, 'staf dapat menyetujui dan menonjolkan testimoni');

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
