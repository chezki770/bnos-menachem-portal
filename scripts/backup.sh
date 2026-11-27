#!/usr/bin/env bash
# Copies the portal's data into backups/portal-<timestamp>.tar.gz and keeps the newest 30.
# Run it nightly from cron, e.g.:
#   15 2 * * * cd /srv/bnos-portal && bash scripts/backup.sh
#
# What's in the archive:
#   data/   — DATA_DIR: every CSV table (and uploads, when FILES_DIR is inside DATA_DIR, the default)
#   files/  — FILES_DIR, only when it's configured outside DATA_DIR
# To restore, stop the portal and extract data/ (and files/) back to the configured locations.
#
# The encryption key (DATA_ENCRYPTION_KEY) is NOT in the backup — store it separately and safely.
set -euo pipefail
cd "$(dirname "$0")/.."

# Use the same settings as the app: the environment first, then .env.
env_value() {
  local name="$1"
  if [ -n "${!name:-}" ]; then printf '%s' "${!name}"; return; fi
  [ -f .env ] || return 0
  sed -n -E "s/^[[:space:]]*${name}[[:space:]]*=[[:space:]]*//p" .env | tail -n 1 | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

abs() { (cd "$1" && pwd -P); }

DATA_DIR="$(env_value DATA_DIR)"; DATA_DIR="${DATA_DIR:-./data}"
FILES_DIR="$(env_value FILES_DIR)"

if [ ! -d "$DATA_DIR" ]; then
  echo "Data folder not found: $DATA_DIR (check DATA_DIR)" >&2
  exit 1
fi
data_abs="$(abs "$DATA_DIR")"

EXTRA=()
if [ -n "$FILES_DIR" ]; then
  if [ ! -d "$FILES_DIR" ]; then
    echo "Uploads folder not found: $FILES_DIR (check FILES_DIR)" >&2
    exit 1
  fi
  files_abs="$(abs "$FILES_DIR")"
  case "$files_abs/" in
    "$data_abs"/*) ;; # already inside DATA_DIR
    *) EXTRA=("$files_abs") ;;
  esac
fi

mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
out="backups/portal-${stamp}.tar.gz"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
# Stage under fixed names (data/, files/) so the layout is the same on every machine.
ln -s "$data_abs" "$staging/data"
if [ -n "${EXTRA[0]:-}" ]; then ln -s "${EXTRA[0]}" "$staging/files"; fi
(cd "$staging" && tar -czhf - data $([ -e files ] && echo files)) > "$out"
chmod 600 "$out"
ls -1t backups/portal-*.tar.gz | tail -n +31 | while read -r old; do rm -- "$old"; done
echo "Backup written: $out"
