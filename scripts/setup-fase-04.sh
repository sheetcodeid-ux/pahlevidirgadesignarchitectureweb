#!/usr/bin/env bash
# Fase 04 — menyiapkan API (Cloudflare Workers) dari nol: Hyperdrive ke
# Supabase, rahasia, lalu deploy.
#
#   ./scripts/setup-fase-04.sh
#
# Jalankan dari mesin sendiri, sudah login lewat `npx wrangler login` di
# akun Cloudflare pahlevidirgadesignarchitecture — BUKAN dari sesi Claude
# Code (di sana tidak ada kredensial wrangler).
#
# Aman dijalankan berulang: tiap langkah memeriksa dulu sebelum membuat.
# Rahasia tidak pernah tercetak ke layar maupun ke log.

set -uo pipefail

cd "$(dirname "$0")/../apps/api"

merah()  { printf '\033[31m%s\033[0m\n' "$*"; }
hijau()  { printf '\033[32m%s\033[0m\n' "$*"; }
redup()  { printf '\033[2m%s\033[0m\n' "$*"; }
judul()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

command -v npx >/dev/null || { merah "Node/npx tidak ditemukan."; exit 2; }

judul "Login Cloudflare"
if ! npx wrangler whoami >/dev/null 2>&1; then
  merah "  Belum login. Jalankan dulu: npx wrangler login"
  exit 2
fi
hijau "  ✓ sudah login"

# ---------------------------------------------------------------------------
# 1. Hyperdrive — jembatan Postgres dari Worker
# ---------------------------------------------------------------------------

judul "Hyperdrive"

SUDAH_ADA="$(npx wrangler hyperdrive list 2>/dev/null | grep -c 'pahlevidirga-db' || true)"

if [ "${SUDAH_ADA:-0}" -ge 1 ]; then
  hijau "  ✓ Hyperdrive 'pahlevidirga-db' sudah ada, dilewati"
  redup "    (kalau connection string database berubah, hapus dulu lewat"
  redup "     'npx wrangler hyperdrive delete pahlevidirga-db' lalu jalankan skrip ini lagi)"
else
  redup "  Hyperdrive dihubungkan ke SESSION pooler Supabase (port 5432), bukan"
  redup "  transaction pooler (6543) yang dipakai psql biasa — Hyperdrive sudah"
  redup "  jadi pooler-nya sendiri, jadi tidak perlu pooler di atas pooler."
  echo

  read -r -p "  Supabase project ref [ddzuzokkqofrpkpokcfa]: " REF
  REF="${REF:-ddzuzokkqofrpkpokcfa}"
  read -r -p "  Region [ap-southeast-1]: " REGION
  REGION="${REGION:-ap-southeast-1}"
  read -r -s -p "  Password database Supabase: " DB_PASS
  echo

  if [ -z "$DB_PASS" ]; then
    merah "  Password wajib diisi untuk membuat Hyperdrive."
    exit 2
  fi

  # urlenc: password Supabase sering mengandung karakter yang merusak URL.
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

  CONN="postgresql://postgres.${REF}:$(urlenc "$DB_PASS")@aws-0-${REGION}.pooler.supabase.com:5432/postgres"

  HD_ID="$(npx wrangler hyperdrive create pahlevidirga-db --connection-string="$CONN" 2>&1 | grep -oE '"[a-f0-9]{32}"' | head -1 | tr -d '"')"

  if [ -z "$HD_ID" ]; then
    merah "  ✗ Gagal membuat Hyperdrive — cek pesan di atas (biasanya password salah)."
    exit 1
  fi

  sed -i.bak "s/GANTI_SETELAH_HYPERDRIVE_DIBUAT/${HD_ID}/" wrangler.jsonc && rm -f wrangler.jsonc.bak
  hijau "  ✓ Hyperdrive dibuat ($HD_ID), wrangler.jsonc diperbarui"
fi

# ---------------------------------------------------------------------------
# 2. Rahasia
# ---------------------------------------------------------------------------

judul "Rahasia (wrangler secret)"
redup "  Kosongkan untuk melewati satu rahasia (kalau sudah pernah diisi)."
echo

isi_rahasia() {
  local nama="$1" nilai="$2"
  if [ -z "$nilai" ]; then
    redup "  ⋯ $nama dilewati (kosong)"
    return 0
  fi
  if printf '%s' "$nilai" | npx wrangler secret put "$nama" >/dev/null 2>&1; then
    hijau "  ✓ $nama"
  else
    merah "  ✗ $nama gagal disimpan"
  fi
}

read -r -s -p "  SUPABASE_SERVICE_ROLE_KEY (Settings > API): " V; echo
isi_rahasia SUPABASE_SERVICE_ROLE_KEY "$V"

read -r -s -p "  SUPABASE_ANON_KEY (Settings > API): " V; echo
isi_rahasia SUPABASE_ANON_KEY "$V"

read -r -s -p "  R2_ACCESS_KEY_ID: " V; echo
isi_rahasia R2_ACCESS_KEY_ID "$V"

read -r -s -p "  R2_SECRET_ACCESS_KEY: " V; echo
isi_rahasia R2_SECRET_ACCESS_KEY "$V"

read -r -s -p "  TURNSTILE_SECRET_KEY: " V; echo
isi_rahasia TURNSTILE_SECRET_KEY "$V"

read -r -s -p "  RESEND_API_KEY: " V; echo
isi_rahasia RESEND_API_KEY "$V"

read -r -p "  INQUIRY_NOTIFY_TO (email studio, boleh kosong dulu): " V
isi_rahasia INQUIRY_NOTIFY_TO "$V"

if ! npx wrangler secret list 2>/dev/null | grep -q IP_HASH_SALT; then
  V="$(openssl rand -hex 32)"
  isi_rahasia IP_HASH_SALT "$V"
  redup "    (dibuat otomatis lewat openssl rand -hex 32)"
else
  hijau "  ✓ IP_HASH_SALT sudah ada, dilewati"
fi

# ---------------------------------------------------------------------------
# 3. Verifikasi lokal, lalu deploy
# ---------------------------------------------------------------------------

judul "Verifikasi"
npm run typecheck && npm test
status=$?

if [ "$status" -ne 0 ]; then
  merah "Masih ada yang merah di atas. Deploy dibatalkan."
  exit 1
fi
hijau "  ✓ typecheck dan test lolos"

judul "Deploy"
npx wrangler deploy

echo
hijau "Fase 04 selesai."
redup "Cek: curl https://pahlevidirga-api.<subdomain-akun>.workers.dev/healthz"
redup "Lalu isi PUBLIC_API_BASE_URL di Cloudflare Workers Build (situs statis)"
redup "dengan URL Worker API ini, supaya form kontak dan panel admin tersambung."
