#!/bin/bash

# Pre-Launch Validation Script
# Runs comprehensive checks before production deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
    fi
}

warn_result() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

echo "🚀 Pre-Launch Validation for RevealUI Framework"
echo "================================================"
echo ""

# 1. Type Checking
echo "1. Running TypeScript type checking..."
if pnpm typecheck:all > /dev/null 2>&1; then
    check_result 0 "Type checking passed"
else
    check_result 1 "Type checking failed"
    echo "   Run: pnpm typecheck:all"
fi

# 2. Package Scripts Validation
echo "2. Validating package.json scripts..."
if pnpm validate:package-scripts > /dev/null 2>&1; then
    check_result 0 "Package scripts validation passed"
else
    check_result 1 "Package scripts validation failed"
    echo "   Run: pnpm validate:package-scripts"
fi

# 3. Linting
echo "3. Running linter..."
if pnpm lint > /dev/null 2>&1; then
    check_result 0 "Linting passed"
else
    check_result 1 "Linting failed"
    echo "   Run: pnpm lint"
fi

# 4. Tests
echo "4. Running tests..."
if pnpm --filter cms test > /dev/null 2>&1; then
    check_result 0 "Tests passed"
else
    check_result 1 "Tests failed"
    echo "   Run: pnpm --filter cms test"
fi

# 5. Build
echo "5. Building applications..."
if pnpm build > /dev/null 2>&1; then
    check_result 0 "Build successful"
else
    check_result 1 "Build failed"
    echo "   Run: pnpm build"
fi

# 6. Security Audit
echo "6. Running security audit..."
AUDIT_OUTPUT=$(pnpm audit --audit-level=high --json 2>/dev/null || echo '{}')
CRITICAL=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
HIGH=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")

if [ "$CRITICAL" -eq "0" ]; then
    check_result 0 "No critical vulnerabilities"
else
    check_result 1 "Critical vulnerabilities found: $CRITICAL"
fi

if [ "$HIGH" -gt "5" ]; then
    warn_result "High vulnerabilities found: $HIGH (may be React 19 peer deps)"
fi

# 7. Environment Variables Check
echo "7. Checking environment variables..."
if [ -f ".env.template" ]; then
    check_result 0 "Environment template exists"
else
    warn_result "Environment template not found"
fi

# 8. Documentation Check
echo "8. Checking documentation..."
DOCS=(
    "docs/DEPLOYMENT-RUNBOOK.md"
    "docs/LAUNCH-CHECKLIST.md"
    "docs/ENVIRONMENT-VARIABLES-GUIDE.md"
    "SECURITY.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        check_result 0 "Documentation exists: $doc"
    else
        warn_result "Missing documentation: $doc"
    fi
done

# 9. Health Check Endpoint
echo "9. Verifying health check endpoint..."
if [ -f "apps/cms/src/app/api/health/route.ts" ]; then
    check_result 0 "Health check endpoint exists"
else
    check_result 1 "Health check endpoint missing"
fi

# 10. Test Coverage (if available)
echo "10. Checking test coverage..."
if [ -d "apps/cms/coverage" ]; then
    COV_REPORT=$(find apps/cms/coverage -name "coverage-summary.json" 2>/dev/null | head -1)
    if [ -n "$COV_REPORT" ]; then
        STATEMENTS=$(jq -r '.total.statements.pct // 0' "$COV_REPORT" 2>/dev/null || echo "0")
        if (( $(echo "$STATEMENTS >= 70" | bc -l 2>/dev/null || echo "0") )); then
            check_result 0 "Test coverage meets threshold: ${STATEMENTS}%"
        else
            warn_result "Test coverage below threshold: ${STATEMENTS}% (target: 70%)"
        fi
    else
        warn_result "Coverage report not found. Run: pnpm --filter cms test:coverage"
    fi
else
    warn_result "Coverage directory not found. Run: pnpm --filter cms test:coverage"
fi

# Summary
echo ""
echo "================================================"
echo "Validation Summary"
echo "================================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed! Ready for launch.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Checks passed with warnings. Review warnings before launch.${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Some checks failed. Fix issues before launch.${NC}"
    exit 1
fi

