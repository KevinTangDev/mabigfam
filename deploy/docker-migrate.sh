#!/bin/sh
# Applies database migrations to the SQLite file on the /data volume.
# Run by the one-shot `migrate` service in compose.yaml before the app starts.
#
# prisma/schema.prisma hardcodes its datasource URL (file:./mabigfam.db), and
# the Prisma CLI ignores DATABASE_URL, so running `migrate deploy` directly
# would create a database inside the image instead of on the volume. Same
# workaround as server/test/globalSetup.ts: migrate from a copy of the schema
# whose URL points at the real file.
#
# Safe to run on every start: `migrate deploy` only applies migrations that
# haven't been applied yet.

set -eu

DB_FILE="${DB_FILE:-/data/mabigfam.db}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$(dirname "$DB_FILE")"
cp -r prisma/migrations "$WORK/migrations"
sed "s|url *= *\"[^\"]*\"|url = \"file:${DB_FILE}\"|" prisma/schema.prisma > "$WORK/schema.prisma"

# If the rewrite silently didn't happen, migrating would target the wrong
# database. Refuse rather than guess.
if ! grep -q "url = \"file:${DB_FILE}\"" "$WORK/schema.prisma"; then
  echo "Could not point the schema at ${DB_FILE}; refusing to migrate." >&2
  exit 1
fi

echo "Applying migrations to ${DB_FILE}"
./node_modules/.bin/prisma migrate deploy --schema "$WORK/schema.prisma"
