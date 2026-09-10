#!/usr/bin/env bash
# Menjalankan supabase/tests/rls_test.sql di Postgres lokal, tanpa menyentuh
# produksi sama sekali.
#
# Gunanya: aturan proyek ini menuntut setiap assertion RLS baru dibuktikan
# MERAH dulu sebelum dibuat hijau. Menjalankannya terhadap produksi berarti
# menerapkan migrasi lebih dulu — persis urutan yang dilarang. Di sini
# skemanya dibangun dari nol setiap kali, jadi keadaan "sebelum migrasi" dan
# "sesudah migrasi" sama-sama bisa diuji.
#
# Postgres menolak jalan sebagai root, jadi seluruhnya dijalankan sebagai user
# `postgres` dan datadir-nya ditaruh di rumahnya sendiri — /tmp tidak selalu
# bisa ditembus user itu, dan gejalanya "Permission denied" yang menyesatkan
# meski direktorinya sudah di-chown.
set -euo pipefail

BIN=/usr/lib/postgresql/16/bin
DIR=/var/lib/postgresql/uji
PORT=55432
AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

sebagai_pg() { su postgres -s /bin/bash -c "$1"; }

if [ ! -f "$DIR/pg16/PG_VERSION" ]; then
  mkdir -p "$DIR/pg16" "$DIR/sock"
  chown -R postgres:postgres "$DIR"
  sebagai_pg "$BIN/initdb -U postgres -A trust -D $DIR/pg16" >/dev/null
fi

if ! sebagai_pg "$BIN/pg_ctl -D $DIR/pg16 status" >/dev/null 2>&1; then
  sebagai_pg "$BIN/pg_ctl -D $DIR/pg16 \
    -o \"-p $PORT -k $DIR/sock -c listen_addresses=''\" -l $DIR/pg.log start" >/dev/null
  sleep 2
fi

URL="postgresql://postgres@localhost:$PORT/postgres?host=$DIR/sock"

# Database bersih tiap kali: tes ini di-rollback, tapi skemanya tidak.
psql -q "$URL" -c 'drop schema if exists public cascade; create schema public;' >/dev/null
psql -q "$URL" -c 'drop schema if exists auth cascade;' >/dev/null

psql -q "$URL" -v ON_ERROR_STOP=1 -f "$AKAR/supabase/tests/shim-lokal.sql" >/dev/null
psql -q "$URL" -v ON_ERROR_STOP=1 -f "$AKAR/supabase/bootstrap.sql" >/dev/null
echo "skema termuat dari bootstrap.sql"

psql "$URL" -v ON_ERROR_STOP=1 -f "$AKAR/supabase/tests/rls_test.sql" 2>&1 \
  | tee /tmp/rls-lokal.log \
  | grep -E "GAGAL|ERROR" || true

LULUS=$(grep -c 'ok:' /tmp/rls-lokal.log || true)
if grep -qE "GAGAL|ERROR" /tmp/rls-lokal.log; then
  echo "MERAH — $LULUS assertion lulus sebelum berhenti"
  exit 1
fi
echo "HIJAU — $LULUS assertion lulus"
