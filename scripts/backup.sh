#!/usr/bin/env bash
# Copies the data folder (CSV files + encrypted uploads) into backups/portal-<timestamp>.tar.gz
# and keeps the newest 30. Run it nightly from cron, e.g.:
#   15 2 * * * cd /srv/bnos-portal && npm run backup   (or: bash scripts/backup.sh)
# The encryption key (DATA_ENCRYPTION_KEY) is NOT in the backup — store it separately and safely.
set -euo pipefail
cd "$(dirname "$0")/.."
DATA_DIR="${DATA_DIR:-./data}"
mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
tar -czf "backups/portal-${stamp}.tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
chmod 600 "backups/portal-${stamp}.tar.gz"
ls -1t backups/portal-*.tar.gz | tail -n +31 | xargs -r rm --
echo "Backup written: backups/portal-${stamp}.tar.gz"
