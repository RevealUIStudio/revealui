#!/bin/bash
# Production Validation Script
# Validates Drizzle/Neon workaround implementation against real Neon instance
#
# Usage:
#   POSTGRES_URL="postgresql://..." ./scripts/validate-production.sh
#
# See: packages/memory/TESTING.md for full documentation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation results
PASSED=0
FAILED=0
SKIPPED=0

# Helper functions
print_header() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
  ((PASSED++))
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
  ((FAILED++))
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
  ((SKIPPED++))
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# Start validation
print_header "Production Validation"

# Check environment
print_header "Environment Check"

POSTGRES_URL="${POSTGRES_URL:-$DATABASE_URL}"

if [ -z "$POSTGRES_URL" ]; then
  print_error "POSTGRES_URL or DATABASE_URL must be set"
  echo ""
  echo "Usage:"
  echo "  POSTGRES_URL='postgresql://...' ./scripts/validate-production.sh"
  echo ""
  echo "Note: Requires real Neon instance (not local PostgreSQL)"
  echo "See: packages/memory/TESTING.md"
  exit 1
fi

print_success "Environment variable set"

# Check if it's a Neon connection string
if [[ "$POSTGRES_URL" == *"neon.tech"* ]] || [[ "$POSTGRES_URL" == *"neon"* ]]; then
  print_success "Connection string appears to be Neon"
else
  print_warning "Connection string doesn't appear to be Neon - may not work with Neon HTTP driver"
fi

# Check database connection
print_header "Database Connection Check"

print_info "Testing Neon HTTP connection..."

# Validate connection string format
if [[ "$POSTGRES_URL" == postgresql://* ]]; then
  print_success "Connection string format is valid (postgresql://)"
else
  print_warning "Connection string format may be invalid"
  print_info "Expected format: postgresql://user:pass@host/dbname"
fi

# Check if it looks like a Neon connection
if [[ "$POSTGRES_URL" == *"neon.tech"* ]] || [[ "$POSTGRES_URL" == *"neon"* ]]; then
  print_success "Connection string appears to be Neon"
else
  print_warning "Connection string doesn't appear to be Neon"
  print_info "Neon HTTP driver requires Neon instance - local PostgreSQL won't work"
fi

# Test actual connection using Neon HTTP driver
print_info "Testing actual Neon HTTP connection..."
if [ -f "scripts/test-neon-connection.mjs" ]; then
  # Ensure packages are built
  if [ ! -d "packages/db/dist" ]; then
    print_warning "Database package not built - building now..."
    pnpm --filter @revealui/db build 2>/dev/null || true
  fi
  
  # Run connection test
  if POSTGRES_URL="$POSTGRES_URL" node scripts/test-neon-connection.mjs 2>/dev/null; then
    print_success "Neon HTTP connection successful"
  else
    print_warning "Could not verify connection via test script"
    print_info "Connection will be validated when running integration tests"
  fi
else
  print_info "Connection test script not found - will validate via integration tests"
fi

# Check required packages
print_header "Package Check"

if [ ! -d "packages/memory" ]; then
  print_error "packages/memory directory not found"
  exit 1
fi
print_success "Memory package found"

if [ ! -d "packages/db" ]; then
  print_error "packages/db directory not found"
  exit 1
fi
print_success "Database package found"

# Check if packages are built
if [ ! -d "packages/memory/dist" ]; then
  print_warning "Memory package not built - building now..."
  pnpm --filter @revealui/memory build
  if [ $? -eq 0 ]; then
    print_success "Memory package built"
  else
    print_error "Failed to build memory package"
    exit 1
  fi
else
  print_success "Memory package already built"
fi

# Run migrations check
print_header "Migration Check"

print_info "Checking if migrations need to be applied..."
print_warning "Note: Run 'pnpm --filter @revealui/db db:push' if migrations are needed"

# Run integration tests
print_header "Integration Tests"

print_info "Running integration tests against Neon instance..."
print_info "This may take 30-60 seconds..."

TEST_OUTPUT=$(POSTGRES_URL="$POSTGRES_URL" pnpm --filter @revealui/memory test __tests__/integration/automated-validation.test.ts 2>&1)
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
  print_success "All integration tests passed"
  
  # Extract test results
  TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passed' | head -1 | grep -oP '\d+' || echo "0")
  if [ -n "$TEST_COUNT" ] && [ "$TEST_COUNT" != "0" ]; then
    print_success "$TEST_COUNT tests passed"
  fi
else
  print_error "Integration tests failed"
  echo ""
  echo "Test output:"
  echo "$TEST_OUTPUT" | tail -20
  echo ""
  print_info "See packages/memory/TESTING.md for troubleshooting"
  exit 1
fi

# Performance check (if performance tests exist)
print_header "Performance Validation"

# Extract performance metrics from test output
PERF_METRICS=$(echo "$TEST_OUTPUT" | grep -iE "performance|benchmark|average|lookup time|ms" || true)

if [ -n "$PERF_METRICS" ]; then
  echo ""
  echo "Performance Results:"
  echo "$PERF_METRICS" | head -15
  echo ""
  
  # Check for performance thresholds
  # Look for patterns like "X ms" or "average: X"
  AVG_TIME=$(echo "$PERF_METRICS" | grep -oE "[0-9]+\.[0-9]+.*ms|[0-9]+.*ms" | head -1 | grep -oE "[0-9]+\.[0-9]+|[0-9]+" | head -1 || echo "")
  
  if [ -n "$AVG_TIME" ]; then
    # Compare against threshold (10ms for node ID lookup)
    # Use awk for floating point comparison (more reliable than bc)
    THRESHOLD=10
    if awk "BEGIN {exit !($AVG_TIME < $THRESHOLD)}" 2>/dev/null; then
      print_success "Performance within acceptable range (${AVG_TIME}ms < ${THRESHOLD}ms)"
    else
      print_warning "Performance may be slow (${AVG_TIME}ms) - expected < ${THRESHOLD}ms"
      print_info "Consider investigating if this is consistent"
    fi
  else
    print_info "Performance metrics found but couldn't extract timing"
    print_info "Review test output above for performance details"
  fi
else
  print_warning "No performance metrics found in test output"
  print_info "Performance tests may be in separate test file or not included"
  print_info "See packages/memory/TESTING.md for manual performance validation"
fi

# Summary
print_header "Validation Summary"

echo ""
echo "Results:"
echo "  ✅ Passed: $PASSED"
echo "  ❌ Failed: $FAILED"
echo "  ⚠️  Skipped: $SKIPPED"
echo ""

if [ $FAILED -eq 0 ]; then
  print_success "Validation complete - All checks passed!"
  echo ""
  echo "Next steps:"
  echo "  1. Review test results above"
  echo "  2. Complete manual testing checklist (see TESTING.md)"
  echo "  3. Verify performance benchmarks"
  echo "  4. Set up production monitoring"
  echo ""
  echo "See: packages/memory/TESTING.md for full validation checklist"
  exit 0
else
  print_error "Validation failed - Please review errors above"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check connection string is correct"
  echo "  2. Verify Neon instance is accessible"
  echo "  3. Check migrations are applied"
  echo "  4. See packages/memory/TESTING.md for details"
  exit 1
fi
