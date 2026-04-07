#!/bin/sh
set -e

echo "Starting server..."
exec node dist/index.js
