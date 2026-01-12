#!/bin/bash
# Run all ElectricSQL sync tests with proper service setup

set -e

echo "=== ElectricSQL Sync Test Execution ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if services are running
check_service() {
    local url=$1
    local name=$2
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is running at $url"
        return 0
    else
        echo -e "${RED}✗${NC} $name is NOT running at $url"
        return 1
    fi
}

# Check CMS server
CMS_RUNNING=false
if check_service "http://localhost:4000/api/conversations" "CMS Server"; then
    CMS_RUNNING=true
    export REVEALUI_TEST_SERVER_URL=http://localhost:4000
    export REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
else
    echo -e "${YELLOW}⚠${NC}  CMS server not running. Some tests will be skipped."
    echo "   Start with: pnpm --filter cms dev"
fi

# Check ElectricSQL service
ELECTRIC_RUNNING=false
if check_service "http://localhost:5133/health" "ElectricSQL Service"; then
    ELECTRIC_RUNNING=true
    export ELECTRIC_SERVICE_URL=http://localhost:5133
    export NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133
else
    echo -e "${YELLOW}⚠${NC}  ElectricSQL service not running. Some tests will be skipped."
    echo "   Start with: pnpm electric:service:start"
fi

echo ""
echo "=== Running Tests ==="
echo ""

# Always run tests that don't require services
echo "1. Running compatibility tests (no services required)..."
pnpm --filter @revealui/sync test compatibility || echo "Compatibility tests failed"

echo ""
echo "2. Running unit tests (no services required)..."
pnpm --filter @revealui/sync test -- --run client.test.ts sync.test.ts || echo "Unit tests failed"

# Run tests that require CMS
if [ "$CMS_RUNNING" = true ]; then
    echo ""
    echo "3. Running baseline performance tests (requires CMS)..."
    pnpm --filter @revealui/sync test baseline || echo "Baseline tests failed"
    
    echo ""
    echo "4. Running write performance tests (requires CMS)..."
    pnpm --filter @revealui/sync test write-performance || echo "Write performance tests failed"
    
    echo ""
    echo "5. Running performance regression tests (requires CMS)..."
    pnpm --filter @revealui/sync test regression || echo "Regression tests failed"
else
    echo ""
    echo "3-5. Skipping CMS-dependent tests (CMS not running)"
fi

# Run tests that require ElectricSQL
if [ "$ELECTRIC_RUNNING" = true ]; then
    echo ""
    echo "6. Running service startup tests (requires ElectricSQL)..."
    pnpm --filter @revealui/sync test service-startup || echo "Service startup tests failed"
    
    echo ""
    echo "7. Running resumability tests (requires ElectricSQL)..."
    pnpm --filter @revealui/sync test resumability || echo "Resumability tests failed"
else
    echo ""
    echo "6-7. Skipping ElectricSQL-dependent tests (service not running)"
fi

# Run tests that require both
if [ "$CMS_RUNNING" = true ] && [ "$ELECTRIC_RUNNING" = true ]; then
    echo ""
    echo "8. Running E2E workflow tests (requires both services)..."
    pnpm --filter @revealui/sync test e2e || echo "E2E tests failed"
    
    echo ""
    echo "9. Running all integration tests (requires both services)..."
    pnpm --filter @revealui/sync test integration || echo "Integration tests failed"
else
    echo ""
    echo "8-9. Skipping E2E and integration tests (services not running)"
fi

echo ""
echo "=== Test Execution Complete ==="
echo ""
echo "Summary:"
echo "  - CMS Server: $([ "$CMS_RUNNING" = true ] && echo "Running" || echo "Not Running")"
echo "  - ElectricSQL Service: $([ "$ELECTRIC_RUNNING" = true ] && echo "Running" || echo "Not Running")"
echo ""
echo "Review test output above for detailed results."
echo "Check TEST_RESULTS.md for collected metrics."
