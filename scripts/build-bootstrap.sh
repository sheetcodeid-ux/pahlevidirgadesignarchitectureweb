#!/usr/bin/env bash
# Menyusun supabase/bootstrap.sql dari file-file migrasi.
#
# Gunanya: menerapkan seluruh skema lewat SQL Editor di dashboard dengan sekali
# tempel, tanpa memasang Supabase CLI. File ini hasil generate — jangan disunting
# langsung; ubah migrasinya lalu jalankan skrip ini lagi.

set -euo pipefail

cd "$(dirname "$0")/.."

OUT=supabase/bootstrap.sql
MIGRATIONS=(
  supabase/migrations/20260818000001_init_schema.sql
  supabase/migrations/20260818000002_rls_policies.sql
)

{
  cat <<'HEADER'
-- ============================================================================
-- BOOTSTRAP — tempel seluruh isi file ini ke SQL Editor Supabase, lalu Run.
--
-- File ini HASIL GENERATE dari supabase/migrations/ oleh
-- scripts/build-bootstrap.sh. Jangan disunting langsung.
--
-- Setelah dijalankan, kedua migrasi juga dicatat di
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

HEADER

  for file in "${MIGRATIONS[@]}"; do
    printf -- '-- ----------------------------------------------------------------------------\n'
    printf -- '-- %s\n' "$(basename "$file")"
    printf -- '-- ----------------------------------------------------------------------------\n\n'
    cat "$file"
    printf '\n'
  done

  cat <<'FOOTER'
-- ----------------------------------------------------------------------------
-- Catat di riwayat migrasi Supabase
-- ----------------------------------------------------------------------------

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key
);

insert into supabase_migrations.schema_migrations (version)
values ('20260818000001'), ('20260818000002')
on conflict (version) do nothing;

commit;
FOOTER
} > "$OUT"

echo "Tertulis: $OUT ($(wc -l < "$OUT") baris)"
