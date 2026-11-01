#!/usr/bin/env bash
# Creates the local "bnos" Postgres role and database (idempotent).
# Use this when Postgres is already running on localhost:5432 (e.g. Postgres.app or Homebrew)
# instead of Docker. Safe to run more than once.
set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install Postgres (brew install postgresql@16) or use Docker: npm run db:up" >&2
  exit 1
fi

ADMIN_URL="${ADMIN_DATABASE_URL:-postgres}"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bnos') THEN
    CREATE ROLE bnos LOGIN PASSWORD 'bnos' CREATEDB;
  ELSE
    ALTER ROLE bnos WITH LOGIN PASSWORD 'bnos' CREATEDB;
  END IF;
END
$$;
SELECT 'CREATE DATABASE bnos OWNER bnos'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bnos')\gexec
SQL

echo "Database ready: postgresql://bnos:bnos@localhost:5432/bnos"
