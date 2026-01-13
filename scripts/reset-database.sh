#!/bin/bash
# Database Reset Script
# WARNING: This will drop all tables and data!

set -e

# Check if DATABASE_URL or POSTGRES_URL is set
if [ -z "$DATABASE_URL" ] && [ -z "$POSTGRES_URL" ]; then
  echo "Error: DATABASE_URL or POSTGRES_URL must be set"
  exit 1
fi

DB_URL="${DATABASE_URL:-$POSTGRES_URL}"

echo "⚠️  WARNING: This will drop all tables and data!"
echo "Database URL: ${DB_URL%%@*}" # Show only connection info, not password
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo "Dropping all tables..."
psql "$DB_URL" -f "$(dirname "$0")/reset-database.sql"

echo "✅ Database reset complete!"
echo "Note: Tables will be recreated when you run the initial migration (0000_misty_pepper_potts.sql)"
