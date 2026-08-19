#!/bin/sh
set -eu

# `migrate deploy` is idempotent. Keeping it here means a new deployment never
# starts against an older schema; Compose waits for PostgreSQL health first.
node_modules/.bin/prisma migrate deploy
exec node server.js
