#!/usr/bin/env bash
# Fase 03 — menyiapkan Google Cloud untuk deploy API ke Cloud Run lewat
# GitHub Actions, tanpa service account key JSON (Workload Identity
# Federation).
#
#   ./scripts/setup-fase-03.sh
#
# Dijalankan dari mesin Anda sendiri — butuh gcloud CLI yang sudah login
# (`gcloud auth login`) ke akun yang punya project GCP tujuan, atau jalankan
# dari Cloud Shell. Skrip ini tidak bisa dijalankan dari sesi Claude Code
# karena tidak ada connector GCP dan tidak ada kredensial gcloud di sana.
#
# Aman dijalankan berulang kali: tiap langkah memeriksa dulu sebelum membuat,
# jadi resource yang sudah ada dilewati, bukan dibuat dobel.

set -uo pipefail

cd "$(dirname "$0")/.."

REPO="sheetcodeid-ux/pahlevidirgadesignarchitectureweb"
REGION="asia-southeast1"
POOL="github-pool"
PROVIDER="github-provider"
SA_NAME="github-deployer"

merah()  { printf '\033[31m%s\033[0m\n' "$*"; }
hijau()  { printf '\033[32m%s\033[0m\n' "$*"; }
redup()  { printf '\033[2m%s\033[0m\n' "$*"; }
judul()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

command -v gcloud >/dev/null || {
  merah "gcloud tidak ditemukan."
  redup "Pasang: https://cloud.google.com/sdk/docs/install — atau jalankan skrip"
  redup "ini dari Cloud Shell (sudah terpasang gcloud + login otomatis)."
  exit 2
}

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
# 0. Project
# ---------------------------------------------------------------------------

judul "Project GCP"
PROJECT="$(gcloud config get-value project 2>/dev/null)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then
  merah "  Tidak ada project aktif."
  redup "  Buat dulu (billing wajib aktif untuk Cloud Run region non-AS):"
  redup "    gcloud projects create <project-id>"
  redup "    gcloud config set project <project-id>"
  redup "  Lalu jalankan skrip ini lagi."
  exit 2
fi
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
hijau "  ✓ $PROJECT (nomor $PROJECT_NUMBER)"

# ---------------------------------------------------------------------------
# 1. API yang dibutuhkan
# ---------------------------------------------------------------------------

judul "Mengaktifkan API"
APIS="run.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com sts.googleapis.com"
# shellcheck disable=SC2086
gcloud services enable $APIS --project "$PROJECT" -q
hijau "  ✓ run, secretmanager, cloudbuild, artifactregistry, iamcredentials, sts"

# ---------------------------------------------------------------------------
# 2. Secret Manager
# ---------------------------------------------------------------------------

judul "Rahasia (Secret Manager)"
redup "  Kosongkan untuk melewati satu rahasia (kalau sudah ada dari run sebelumnya)."
echo

buat_atau_lewati() {
  local nama="$1" nilai="$2"
  if gcloud secrets describe "$nama" --project "$PROJECT" >/dev/null 2>&1; then
    hijau "  ✓ $nama sudah ada, dilewati"
    return 0
  fi
  if [ -z "$nilai" ]; then
    redup "  ⋯ $nama dilewati (kosong)"
    return 0
  fi
  printf '%s' "$nilai" | gcloud secrets create "$nama" --project "$PROJECT" --data-file=- -q >/dev/null
  hijau "  ✓ $nama dibuat"
}

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  read -r -p "  Supabase project ref [ddzuzokkqofrpkpokcfa]: " SUPABASE_PROJECT_REF
  SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-ddzuzokkqofrpkpokcfa}"
fi

DATABASE_URL=""
if ! gcloud secrets describe database-url --project "$PROJECT" >/dev/null 2>&1; then
  redup "  Backend pakai TRANSACTION pooler (port 6543) — beda dari session"
  redup "  pooler (5432) yang dipakai Fase 01 untuk migrasi/tes RLS."
  read -r -s -p "  Password database Supabase (kosongkan untuk lewati): " DB_PASS
  echo
  if [ -n "$DB_PASS" ]; then
    DATABASE_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:$(urlenc "$DB_PASS")@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
  fi
fi
buat_atau_lewati database-url "$DATABASE_URL"

read -r -s -p "  SUPABASE_JWT_SECRET (Settings > API > JWT Settings, kosongkan untuk lewati): " V; echo
buat_atau_lewati supabase-jwt-secret "$V"

read -r -s -p "  SUPABASE_SERVICE_ROLE_KEY (Settings > API, kosongkan untuk lewati): " V; echo
buat_atau_lewati supabase-service-role-key "$V"

read -r -s -p "  R2_ACCESS_KEY_ID (kosongkan untuk lewati): " V; echo
buat_atau_lewati r2-access-key-id "$V"

read -r -s -p "  R2_SECRET_ACCESS_KEY (kosongkan untuk lewati): " V; echo
buat_atau_lewati r2-secret-access-key "$V"

read -r -s -p "  TURNSTILE_SECRET_KEY (widget 'Form kontak pahlevidirga', kosongkan untuk lewati): " V; echo
buat_atau_lewati turnstile-secret "$V"

read -r -s -p "  RESEND_API_KEY (kosongkan untuk lewati): " V; echo
buat_atau_lewati resend-api-key "$V"

if ! gcloud secrets describe ip-hash-salt --project "$PROJECT" >/dev/null 2>&1; then
  V="$(openssl rand -hex 32)"
  buat_atau_lewati ip-hash-salt "$V"
  redup "    (dibuat otomatis lewat openssl rand -hex 32)"
fi

# ---------------------------------------------------------------------------
# 3. Service account deployer
# ---------------------------------------------------------------------------

judul "Service account deployer"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT" >/dev/null 2>&1; then
  hijau "  ✓ $SA_EMAIL sudah ada"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --project "$PROJECT" \
    --display-name "Deploy API ke Cloud Run dari GitHub Actions" -q
  hijau "  ✓ $SA_EMAIL dibuat"
fi

judul "Hak akses deployer"
for ROLE in roles/run.admin roles/iam.serviceAccountUser roles/cloudbuild.builds.editor \
            roles/artifactregistry.writer roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:${SA_EMAIL}" --role "$ROLE" -q >/dev/null
done
hijau "  ✓ run.admin, iam.serviceAccountUser, cloudbuild.builds.editor, artifactregistry.writer, secretmanager.secretAccessor"

# Service account RUNTIME Cloud Run (default compute) juga perlu baca rahasia
# saat container start — beda dari service account DEPLOYER di atas.
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member "serviceAccount:${COMPUTE_SA}" --role roles/secretmanager.secretAccessor -q >/dev/null
hijau "  ✓ secretmanager.secretAccessor untuk service account runtime ($COMPUTE_SA)"

# ---------------------------------------------------------------------------
# 4. Workload Identity Federation — tanpa key JSON
# ---------------------------------------------------------------------------

judul "Workload Identity Federation"

if gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT" --location global >/dev/null 2>&1; then
  hijau "  ✓ pool $POOL sudah ada"
else
  gcloud iam workload-identity-pools create "$POOL" \
    --project "$PROJECT" --location global \
    --display-name "GitHub Actions" -q
  hijau "  ✓ pool $POOL dibuat"
fi

if gcloud iam workload-identity-pools providers describe "$PROVIDER" \
    --project "$PROJECT" --location global --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  hijau "  ✓ provider $PROVIDER sudah ada"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --project "$PROJECT" --location global --workload-identity-pool "$POOL" \
    --display-name "GitHub" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition "assertion.repository == '${REPO}'" -q
  hijau "  ✓ provider $PROVIDER dibuat, dibatasi ke repo $REPO"
fi

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" \
  -q >/dev/null
hijau "  ✓ $SA_EMAIL boleh diimpersonasi dari Actions repo $REPO"

WIP="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

# ---------------------------------------------------------------------------
# 5. Ringkasan
# ---------------------------------------------------------------------------

judul "Selesai — tempel ini ke GitHub"
echo
echo "Settings → Secrets and variables → Actions → Secrets:"
echo
printf '  GCP_WORKLOAD_IDENTITY_PROVIDER = %s\n' "$WIP"
printf '  GCP_SERVICE_ACCOUNT            = %s\n' "$SA_EMAIL"
echo
echo "Settings → Secrets and variables → Actions → Variables:"
echo
printf '  R2_ACCOUNT_ID      = cf6a6bde45d3fd8a93463e6cc7e71aa1\n'
printf '  R2_BUCKET          = pahlevidirga-media\n'
printf '  R2_PUBLIC_BASE_URL = https://pub-e4c6ca03e74842e195bb46bc8445269f.r2.dev\n'
printf '  INQUIRY_NOTIFY_TO  = studio@pahlevidirga.com\n'
printf '  INQUIRY_FROM       = website@pahlevidirga.com\n'
redup '  ALLOWED_ORIGINS     = (isi dengan URL situs yang tayang — workers.dev untuk'
redup '                         sementara, ganti begitu domain sendiri aktif)'
echo
redup "Rahasia yang tadi dilewati (kosong) masih perlu dibuat manual:"
redup "  printf '%s' \"<nilai>\" | gcloud secrets create <nama> --project $PROJECT --data-file=-"
echo
hijau "Setelah secrets & variables terisi di GitHub, push apa pun ke apps/api/**"
hijau "di branch main akan otomatis deploy ke Cloud Run region $REGION."
