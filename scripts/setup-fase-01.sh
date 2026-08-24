#!/usr/bin/env bash
# Fase 01 — menyiapkan database Supabase dari nol, dalam satu perintah.
#
#   ./scripts/setup-fase-01.sh
#
# Skrip ini menanyakan yang perlu ditanyakan, lalu mengerjakan sisanya:
# menyusun connection string, menerapkan skema, mendaftarkan akun staf,
# dan membuktikan hasilnya lewat verify-supabase.sh + rls_test.sql.
#
# Aman dijalankan berulang kali. Kalau skema sudah terpasang ia melewatinya,
# bukan menimpanya. Password tidak pernah tercetak ke layar maupun ke log.

set -uo pipefail

cd "$(dirname "$0")/.."

RAHASIA=".env.supabase.local"   # tercakup .gitignore lewat pola .env.*

merah()  { printf '\033[31m%s\033[0m\n' "$*"; }
hijau()  { printf '\033[32m%s\033[0m\n' "$*"; }
redup()  { printf '\033[2m%s\033[0m\n' "$*"; }
judul()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

command -v psql >/dev/null || {
  merah "psql tidak ditemukan."
  redup "Windows: tambahkan C:\\Program Files\\PostgreSQL\\18\\bin ke PATH."
  exit 2
}

# Password Supabase sering mengandung karakter yang merusak URL kalau
# ditempel apa adanya. Ini penyebab paling sering error \"could not translate
# host name\" yang menyesatkan itu.
urlenc() {
  local s="$1" out="" c i
  for (( i = 0; i < ${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *)               out+="$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf '%s' "$out"
}

# ---------------------------------------------------------------------------
# 1. Connection string
# ---------------------------------------------------------------------------

if [ -f "$RAHASIA" ]; then
  # shellcheck disable=SC1090
  . "$RAHASIA"
fi

if [ -z "${SUPABASE_DIRECT_URL:-}" ]; then
  judul "Sambungan ke database"
  redup "Buka dashboard project pahlevidirga-web. Project ref ada di URL"
  redup "browser: supabase.com/dashboard/project/<REF-NYA-DI-SINI>"
  echo

  read -r -p "  Project ref                : " REF
  read -r -p "  Region [ap-southeast-1]    : " REGION
  REGION="${REGION:-ap-southeast-1}"
  read -r -s -p "  Password database          : " PASS
  echo

  if [ -z "$REF" ] || [ -z "$PASS" ]; then
    merah "Ref dan password wajib diisi."
    exit 2
  fi

  # Session pooler, bukan direct connection: direct hanya menerima IPv6 dan
  # project Free tidak punya add-on IPv4. Port 5432 (session), bukan 6543
  # (transaction) — rls_test.sql butuh state yang bertahan antar statement.
  SUPABASE_DIRECT_URL="postgresql://postgres.${REF}:$(urlenc "$PASS")@aws-0-${REGION}.pooler.supabase.com:5432/postgres"

  umask 077
  printf "SUPABASE_DIRECT_URL='%s'\n" "$SUPABASE_DIRECT_URL" > "$RAHASIA"
  redup "  Disimpan di $RAHASIA (diabaikan git) supaya tidak ditanya lagi."
fi

export SUPABASE_DIRECT_URL

judul "Menguji sambungan"
if ! psql "$SUPABASE_DIRECT_URL" -tAc 'select 1' >/dev/null 2>&1; then
  merah "  Tidak bisa menyambung."
  echo
  redup "  Kemungkinan penyebab, berurut dari yang paling sering:"
  redup "    • password salah — reset di Project Settings → Database"
  redup "    • project ref salah ketik"
  redup "    • region bukan ap-southeast-1"
  echo
  redup "  Hapus $RAHASIA lalu jalankan lagi untuk mengisi ulang."
  exit 1
fi
hijau "  ✓ tersambung"

# ---------------------------------------------------------------------------
# 2. Skema
# ---------------------------------------------------------------------------

judul "Skema"
sudah_ada="$(psql "$SUPABASE_DIRECT_URL" -tAc \
  "select count(*) from information_schema.tables
   where table_schema='public' and table_name='projects';" 2>/dev/null | tr -d '[:space:]')"

if [ "${sudah_ada:-0}" = "1" ]; then
  hijau "  ✓ sudah terpasang, dilewati"
else
  if psql "$SUPABASE_DIRECT_URL" -v ON_ERROR_STOP=1 -q -f supabase/bootstrap.sql; then
    hijau "  ✓ bootstrap.sql diterapkan"
  else
    merah "  ✗ bootstrap.sql gagal — tidak ada yang berubah (semuanya dalam transaksi)"
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 3. Akun staf
# ---------------------------------------------------------------------------

judul "Akun staf"
jumlah_profil="$(psql "$SUPABASE_DIRECT_URL" -tAc \
  'select count(*) from public.profiles;' 2>/dev/null | tr -d '[:space:]')"

if [ "${jumlah_profil:-0}" -ge 1 ] 2>/dev/null; then
  hijau "  ✓ $jumlah_profil akun sudah terdaftar"
  psql "$SUPABASE_DIRECT_URL" -tAc \
    "select '    · ' || u.email || '  (' || p.role || ')'
     from public.profiles p join auth.users u on u.id = p.id order by p.role;"
else
  redup "  Belum ada akun staf. Buat dulu user-nya di dashboard:"
  redup "  Authentication → Users → Add user → Create new user"
  redup "  (jangan pakai invite email — Resend belum terpasang)"
  echo
  read -r -p "  Email superadmin (kosongkan untuk lewati) : " EMAIL_ADMIN
  if [ -n "$EMAIL_ADMIN" ]; then
    read -r -p "  Nama superadmin                           : " NAMA_ADMIN
    read -r -p "  Email staf penginput (boleh kosong)       : " EMAIL_STAF
    NAMA_STAF=""
    [ -n "$EMAIL_STAF" ] && read -r -p "  Nama staf penginput                       : " NAMA_STAF

    daftarkan() {
      local email="$1" nama="$2" peran="$3" hasil
      [ -z "$email" ] && return 0
      hasil="$(psql "$SUPABASE_DIRECT_URL" -tAq <<SQL | tr -d '[:space:]'
insert into public.profiles (id, full_name, role)
select id, \$\$${nama}\$\$, '${peran}'
from auth.users where email = \$\$${email}\$\$
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name
returning 1;
SQL
)"
      if [ "$hasil" = "1" ]; then
        hijau "  ✓ $email → $peran"
      else
        merah "  ✗ $email tidak ada di Authentication → Users"
        redup "    Buat user-nya dulu di dashboard, lalu jalankan skrip ini lagi."
      fi
    }

    daftarkan "$EMAIL_ADMIN" "$NAMA_ADMIN" admin
    daftarkan "$EMAIL_STAF"  "$NAMA_STAF"  editor
  fi
fi

# ---------------------------------------------------------------------------
# 4. Pembuktian
# ---------------------------------------------------------------------------

judul "Verifikasi"
./scripts/verify-supabase.sh
status_verify=$?

judul "Uji RLS"
psql "$SUPABASE_DIRECT_URL" -f supabase/tests/rls_test.sql
status_rls=$?

echo
if [ "$status_verify" -eq 0 ] && [ "$status_rls" -eq 0 ]; then
  hijau "Fase 01 selesai."
  echo
  redup "Satu hal yang tidak bisa dikerjakan skrip ini, karena hanya ada di dashboard:"
  redup "  Project Settings → API → matikan \"Automatically expose new tables\""
  redup "Itu menentukan nasib tabel yang kamu buat nanti, bukan yang sekarang."
  echo
  redup "Berikutnya: Fase 02 — Build command Worker di dashboard Cloudflare."
else
  merah "Masih ada yang merah di atas. Jangan lanjut ke Fase 02 dulu."
fi
