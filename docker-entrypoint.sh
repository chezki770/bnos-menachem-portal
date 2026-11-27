#!/bin/sh
# Shared by the runtime and tools images. Starts as root only long enough to make sure the mounted
# data folder (a fresh bind mount is created root-owned) belongs to the portal user, then runs the
# command as that user, so the portal and admin tools always read and write the same files.
set -e
DATA="${DATA_DIR:-/app/data}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA"
  chown -R portal:portal "$DATA"
  exec su-exec portal "$@"
fi
exec "$@"
