#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
target_dir="$script_dir/secrets/postgres"
common_name=${POSTGRES_TLS_CN:-postgres}

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo so the key can be owned by the PostgreSQL container user." >&2
  exit 1
fi

if [ -e "$target_dir/server.key" ] || [ -e "$target_dir/server.crt" ]; then
  echo "PostgreSQL TLS files already exist at $target_dir; refusing to overwrite them." >&2
  exit 1
fi

install -d -m 700 "$target_dir"
openssl req -new -x509 -nodes -days 825 -sha256 \
  -subj "/CN=$common_name" \
  -keyout "$target_dir/server.key" \
  -out "$target_dir/server.crt"
chown 999:999 "$target_dir/server.key" "$target_dir/server.crt"
chmod 600 "$target_dir/server.key"
chmod 644 "$target_dir/server.crt"

echo "Created PostgreSQL TLS certificate files in $target_dir."
