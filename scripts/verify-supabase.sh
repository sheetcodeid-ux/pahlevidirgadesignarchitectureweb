#!/usr/bin/env bash
# Memeriksa apakah project Supabase sudah tersiapkan dengan benar.
#
#   ./scripts/verify-supabase.sh "<direct connection string>"
#
# Connection string dibaca dari argumen atau env SUPABASE_DIRECT_URL, dan tidak
# pernah ikut tercetak — output-nya aman dibagikan.

set -uo pipefail

cd "$(dirname "$0")/.."

DB_URL="${1:-${SUPABASE_DIRECT_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "Butuh connection string langsung (port 5432)." >&2
  echo "Dashboard → Project Settings → Database → Connection string" >&2
  exit 2
fi

command -v psql >/dev/null || { echo "psql tidak ditemukan. macOS: brew install libpq" >&2; exit 2; }

lolos=0
gagal=0

# periksa <label> <sql-yang-mengembalikan-satu-nilai> <nilai-yang-diharapkan>
periksa() {
  local label="$1" sql="$2" harap="$3" dapat
  dapat="$(psql "$DB_URL" -tAc "$sql" 2>/dev/null | tr -d '[:space:]')"

  if [ "$dapat" = "$harap" ]; then
    printf '  \033[32m✓\033[0m %s\n' "$label"
    lolos=$((lolos + 1))
  else
    printf '  \033[31m✗\033[0m %s \033[2m(harap %s, dapat %s)\033[0m\n' "$label" "$harap" "${dapat:-kosong}"
    gagal=$((gagal + 1))
  fi
}

echo
echo "Memeriksa database…"
echo

echo "Skema"
periksa "empat tabel terbentuk" \
  "select count(*) from information_schema.tables
   where table_schema='public'
     and table_name in ('projects','project_images','inquiries','profiles');" 4

periksa "riwayat migrasi tercatat" \
  "select count(*) from supabase_migrations.schema_migrations
   where version in ('20260818000001','20260818000002');" 2

echo
echo "Row Level Security"
periksa "RLS aktif di keempat tabel" \
  "select count(*) from pg_tables
   where schemaname='public'
     and tablename in ('projects','project_images','inquiries','profiles')
     and rowsecurity;" 4

periksa "policy terpasang" \
  "select count(*) from pg_policies where schemaname='public';" 8

echo
echo "Hak akses (yang paling mudah salah)"
periksa "anon hanya SELECT pada projects" \
  "select string_agg(distinct privilege_type,',') from information_schema.role_table_grants
   where grantee='anon' and table_schema='public' and table_name='projects';" "SELECT"

periksa "anon tidak punya hak atas inquiries" \
  "select count(*) from information_schema.role_table_grants
   where grantee='anon' and table_schema='public' and table_name='inquiries';" 0

periksa "anon tidak punya hak atas profiles" \
  "select count(*) from information_schema.role_table_grants
   where grantee='anon' and table_schema='public' and table_name='profiles';" 0

periksa "staf tidak bisa membuat inquiry" \
  "select count(*) from information_schema.role_table_grants
   where grantee='authenticated' and table_schema='public'
     and table_name='inquiries' and privilege_type='INSERT';" 0

echo
echo "Akun staf"
jumlah_staf="$(psql "$DB_URL" -tAc "select count(*) from public.profiles;" 2>/dev/null | tr -d '[:space:]')"
if [ "${jumlah_staf:-0}" -ge 1 ] 2>/dev/null; then
  printf '  \033[32m✓\033[0m %s akun staf terdaftar di public.profiles\n' "$jumlah_staf"
  lolos=$((lolos + 1))
else
  printf '  \033[31m✗\033[0m belum ada baris di public.profiles \033[2m(user Supabase tanpa baris di sini diperlakukan sebagai pengunjung)\033[0m\n'
  gagal=$((gagal + 1))
fi

echo
if [ "$gagal" -eq 0 ]; then
  printf '\033[32m%s pemeriksaan lolos.\033[0m Database siap.\n' "$lolos"
  echo
  echo "Berikutnya, uji perilaku RLS-nya sungguhan:"
  echo "  psql \"\$SUPABASE_DIRECT_URL\" -f supabase/tests/rls_test.sql"
  echo
  exit 0
fi

printf '\033[31m%s pemeriksaan gagal\033[0m, %s lolos.\n' "$gagal" "$lolos"
echo
echo "Kalau semuanya gagal, kemungkinan bootstrap.sql belum dijalankan."
echo "Kalau hanya bagian hak akses yang gagal, cek setelan"
echo "\"Automatically expose new tables\" di Project Settings → API."
echo
exit 1
