#!/bin/sh
set -e

echo "Running database migrations..."
node dist/db/migrate.js

echo "Seeding system categories and rules..."
node dist/db/seed.js

echo "Starting server..."
exec node dist/index.js
