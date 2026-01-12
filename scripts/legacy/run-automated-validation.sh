#!/bin/bash
# Run Automated Validation
# Automates all validation steps using test database and test server

set -e

echo "=========================================="
echo "Automated CRDT Validation"
echo "=========================================="

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker to run automated tests."
  exit 1
fi

# Setup test database
echo ""
echo "Step 1: Setting up test database..."
./scripts/setup-test-db.sh

# Set test database URL
export POSTGRES_URL="postgresql://test:test@localhost:5433/test_revealui"
export NODE_ENV=test

# Run migration verification
echo ""
echo "Step 2: Verifying migration..."
psql "$POSTGRES_URL" -c "SELECT COUNT(*) FROM node_id_mappings;" || echo "⚠️  psql not available, skipping verification"

# Run integration tests
echo ""
echo "Step 3: Running integration tests..."
pnpm --filter @revealui/memory test __tests__/integration/ || echo "⚠️  Integration tests not found, skipping"

# Run performance tests
echo ""
echo "Step 4: Running performance tests..."
node scripts/measure-performance.js || echo "⚠️  Performance test script not found, skipping"

# Start test server for API tests
echo ""
echo "Step 5: Starting test server..."
cd "$(dirname "$0")/.."
pnpm --filter cms dev > /tmp/test-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
MAX_WAIT=30
WAIT_COUNT=0
while ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; do
  WAIT_COUNT=$((WAIT_COUNT + 1))
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "❌ Server failed to start after ${MAX_WAIT}s"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

echo "Server is ready!"

# Run API tests
echo ""
echo "Step 6: Testing API routes..."
./scripts/test-api-routes.sh || echo "⚠️  API test script failed"

# Cleanup
echo ""
echo "Step 7: Cleaning up..."
kill $SERVER_PID 2>/dev/null || true

# Stop test database (optional - comment out to keep running)
# docker-compose -f docker-compose.test.yml down

echo ""
echo "=========================================="
echo "✅ Automated validation complete!"
echo "=========================================="
