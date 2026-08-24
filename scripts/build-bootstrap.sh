#!/usr/bin/env bash
# Menyusun supabase/bootstrap.sql dari file-file migrasi.
#
# Gunanya: menerapkan seluruh skema lewat SQL Editor di dashboard dengan sekali
# tempel, tanpa memasang Supabase CLI. File ini hasil generate — jangan disunting
# langsung; ubah migrasinya lalu jalankan skrip ini lagi.
#
# Daftar migrasinya dibaca dari direktori, bukan ditulis di sini. Versi yang
# sebelumnya menghardcode daftar itu diam-diam menghasilkan bootstrap yang
# tertinggal setiap kali ada migrasi baru.

set -euo pipefail

cd "$(dirname "$0")/.."

OUT=supabase/bootstrap.sql

shopt -s nullglob
MIGRATIONS=(supabase/migrations/*.sql)
shopt -u nullglob

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
  echo "Tidak ada migrasi di supabase/migrations/." >&2
  exit 1
fi

{
  cat <<'HEADER'
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
FOOTER

  # Versi = angka di depan nama file, nama = sisanya tanpa .sql.
  baris=()
  for file in "${MIGRATIONS[@]}"; do
    dasar="$(basename "$file" .sql)"
    versi="${dasar%%_*}"
    nama="${dasar#*_}"
    baris+=("  ('${versi}', '${nama}')")
  done

  # Koma antar baris, titik koma di akhir.
  printf '%s,\n' "${baris[@]::${#baris[@]}-1}"
  printf '%s\n' "${baris[-1]}"

  cat <<'FOOTER2'
on conflict (version) do update set name = excluded.name;

commit;
FOOTER2
} > "$OUT"

echo "Tertulis: $OUT ($(wc -l < "$OUT") baris, ${#MIGRATIONS[@]} migrasi)"
