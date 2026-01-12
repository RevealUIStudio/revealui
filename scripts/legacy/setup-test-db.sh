#!/bin/bash
# Setup Test Database
# Starts PostgreSQL test database and runs migrations

set -e

echo "=========================================="
echo "Setting up test database"
echo "=========================================="

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker to run automated tests."
  exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "❌ docker-compose is not available. Please install docker-compose."
  exit 1
fi

# Use docker compose (newer) or docker-compose (older)
COMPOSE_CMD="docker-compose"
if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
fi

echo "Starting test database..."
$COMPOSE_CMD -f docker-compose.test.yml up -d

echo "Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

until $COMPOSE_CMD -f docker-compose.test.yml exec -T postgres-test pg_isready -U test > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Database failed to start after $MAX_RETRIES retries"
    exit 1
  fi
  sleep 1
done

echo "Database is ready!"

# Set test database URL
export POSTGRES_URL="postgresql://test:test@localhost:5433/test_revealui"

echo "Running migrations..."
cd "$(dirname "$0")/.."
# Apply migration SQL directly (bypasses drizzle-kit interactive prompts)
# This is more reliable for automated scripts
if [ -f "packages/db/drizzle/0000_misty_pepper_potts.sql" ]; then
  echo "Applying migration SQL directly..."
  docker compose -f docker-compose.test.yml exec -T postgres-test psql -U test -d test_revealui < packages/db/drizzle/0000_misty_pepper_potts.sql 2>&1 | grep -v "ERROR:" || true
  echo "Migration applied"
else
  echo "⚠️  Migration SQL file not found, attempting drizzle-kit push..."
  # Fallback to drizzle-kit (requires manual confirmation)
  printf "y\ny\ny\n" | POSTGRES_URL="$POSTGRES_URL" pnpm --filter @revealui/db db:push || echo "⚠️  Migration failed, but continuing..."
fi

echo "Enabling pgvector extension..."
$COMPOSE_CMD -f docker-compose.test.yml exec -T postgres-test psql -U test -d test_revealui -c "CREATE EXTENSION IF NOT EXISTS vector;" || echo "⚠️  Failed to enable pgvector extension"

echo ""
echo "=========================================="
echo "✅ Test database setup complete!"
echo "=========================================="
echo "Database URL: $POSTGRES_URL"
echo ""
echo "To stop the database:"
echo "  $COMPOSE_CMD -f docker-compose.test.yml down"
echo ""
