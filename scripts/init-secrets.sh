#!/usr/bin/env bash
# Génère un fichier .env avec des secrets forts (jamais commité : .env est dans .gitignore).
# Usage : scripts/init-secrets.sh [--host postgres|localhost] [--url https://app.exemple.com] [--force]
set -euo pipefail
umask 077

HOST="postgres"
APP_URL="http://localhost:3000"
FORCE=0
OUT=".env"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2 ;;
    --url) APP_URL="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done

command -v openssl >/dev/null || { echo "openssl est requis" >&2; exit 1; }
if [[ -e "$OUT" && $FORCE -ne 1 ]]; then
  echo "$OUT existe déjà : rien n'est écrasé (utiliser --force pour régénérer, les anciennes données chiffrées deviendraient illisibles)." >&2
  exit 1
fi

pw() { openssl rand -hex 24; }          # 48 caractères hexadécimaux
key() { openssl rand -base64 32; }      # 32 octets en base64

POSTGRES_PASSWORD=$(pw)
MIGRATOR_PASSWORD=$(pw)
APP_PASSWORD=$(pw)
AUTH_PASSWORD=$(pw)

cat > "$OUT" <<ENV
# Généré par scripts/init-secrets.sh le $(date -u +%Y-%m-%dT%H:%M:%SZ). NE PAS COMMITER.
NODE_ENV=production
SCOUTRA_MODE=saas

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
SCOUTRA_MIGRATOR_PASSWORD=${MIGRATOR_PASSWORD}
SCOUTRA_APP_PASSWORD=${APP_PASSWORD}
SCOUTRA_AUTH_PASSWORD=${AUTH_PASSWORD}

DATABASE_URL=postgres://scoutra_app:${APP_PASSWORD}@${HOST}:5432/scoutra
DATABASE_AUTH_URL=postgres://scoutra_auth:${AUTH_PASSWORD}@${HOST}:5432/scoutra
DATABASE_MIGRATOR_URL=postgres://scoutra_migrator:${MIGRATOR_PASSWORD}@${HOST}:5432/scoutra

SCOUTRA_MASTER_KEY=$(key)
SCOUTRA_MASTER_KEY_VERSION=1
SCOUTRA_HASH_KEY=$(key)

BETTER_AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
BETTER_AUTH_URL=${APP_URL}
SCOUTRA_ALLOW_SIGNUP=false
SCOUTRA_REQUIRE_EMAIL_VERIFICATION=true
ENV
chmod 600 "$OUT"
echo "Secrets générés dans $OUT (droits 600). Sauvegardez SCOUTRA_MASTER_KEY hors du serveur : sans elle, les clés API chiffrées sont perdues."
