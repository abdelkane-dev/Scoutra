#!/usr/bin/env bash
# Exécuté UNE fois par l'image postgres à l'initialisation du volume.
# Crée les rôles séparés : migrateur (propriétaire), applicatif (RLS), auth (identité).
set -euo pipefail

check() {
  local name="$1" value="${2:-}"
  if [[ ${#value} -lt 24 ]]; then
    echo "Refus : $name manquant ou trop court (24 caractères minimum). Lancer scripts/init-secrets.sh." >&2
    exit 1
  fi
}
check SCOUTRA_MIGRATOR_PASSWORD "${SCOUTRA_MIGRATOR_PASSWORD:-}"
check SCOUTRA_APP_PASSWORD "${SCOUTRA_APP_PASSWORD:-}"
check SCOUTRA_AUTH_PASSWORD "${SCOUTRA_AUTH_PASSWORD:-}"

# Mots de passe passés en variables psql et cités par format(%L) : pas de concaténation.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v migrator_pw="$SCOUTRA_MIGRATOR_PASSWORD" -v app_pw="$SCOUTRA_APP_PASSWORD" -v auth_pw="$SCOUTRA_AUTH_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE scoutra_migrator LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS', :'migrator_pw') \gexec
SELECT format('CREATE ROLE scoutra_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', :'app_pw') \gexec
SELECT format('CREATE ROLE scoutra_auth LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', :'auth_pw') \gexec
CREATE DATABASE scoutra OWNER scoutra_migrator;
REVOKE ALL ON DATABASE scoutra FROM PUBLIC;
GRANT CONNECT ON DATABASE scoutra TO scoutra_app, scoutra_auth;
SQL
