#!/bin/sh
set -e

export DATABASE_URL="${DATABASE_URL:-file:/app/data/dev.db}"
export UPLOADS_DIR="${UPLOADS_DIR:-/app/data/uploads}"

# Apply migrations. This is a no-op when the schema is already up to date, so a
# redeploy never touches existing data.
node_modules/.bin/prisma migrate deploy

# Seed demo accounts (admin/professors/students + subjects + sample records)
# only when the database has not been initialised yet. This never re-runs while
# real data exists, so professors' uploads survive restarts.
if ! node_modules/.bin/tsx -e "
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  const { PrismaClient } = require('./src/generated/prisma/client');
  const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
  p.user.count().then(n => process.exit(n > 0 ? 0 : 1));
"; then
  node_modules/.bin/tsx prisma/seed.ts
fi

exec node_modules/.bin/next start