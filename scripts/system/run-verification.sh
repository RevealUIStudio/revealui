#!/bin/bash

###############################################################################
# Automated System Verification Script
#
# Runs automated checks from the verification checklist.
# Some manual checks still required (see verification-checklist.md)
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
SKIPPED=0

# Test result function
test_result() {
    local name="$1"
    local result="$2"
    local details="$3"

    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASSED++))
    elif [ "$result" = "FAIL" ]; then
        echo -e "${RED}✗${NC} $name"
        if [ -n "$details" ]; then
            echo -e "  ${RED}$details${NC}"
        fi
        ((FAILED++))
    else
        echo -e "${YELLOW}○${NC} $name (skipped)"
        ((SKIPPED++))
    fi
}

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Automated System Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo

# Pre-Verification Checks
echo -e "${BLUE}Pre-Verification Checks${NC}"
echo

# Node.js version
if [ "$(node --version)" = "v24.13.0" ]; then
    test_result "Node.js version v24.13.0" "PASS"
else
    test_result "Node.js version v24.13.0" "FAIL" "Found: $(node --version)"
fi

# pnpm installed
if command -v pnpm &> /dev/null; then
    test_result "pnpm installed" "PASS"
else
    test_result "pnpm installed" "FAIL"
fi

# Zombie processes
ZOMBIE_COUNT=$(ps aux | grep -E ' (Z|z) ' | grep -v grep | wc -l)
if [ "$ZOMBIE_COUNT" -eq 0 ]; then
    test_result "No zombie processes" "PASS"
else
    test_result "No zombie processes" "FAIL" "Found $ZOMBIE_COUNT zombies"
fi

# Disk space (> 20% free)
DISK_FREE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_FREE" -lt 80 ]; then
    test_result "Sufficient disk space (>20% free)" "PASS"
else
    test_result "Sufficient disk space (>20% free)" "FAIL" "${DISK_FREE}% used"
fi

# Memory available (> 1GB free)
MEM_FREE_MB=$(free -m | grep "^Mem" | awk '{print $7}')
if [ "$MEM_FREE_MB" -gt 1024 ]; then
    test_result "Sufficient memory (>1GB free)" "PASS"
else
    test_result "Sufficient memory (>1GB free)" "FAIL" "${MEM_FREE_MB}MB free"
fi

echo

# Dependencies
echo -e "${BLUE}Dependency Checks${NC}"
echo

# node_modules exists
if [ -d "node_modules" ]; then
    test_result "node_modules directory exists" "PASS"
else
    test_result "node_modules directory exists" "FAIL"
fi

# .env files
if [ -f ".env" ] || [ -f ".env.local" ]; then
    test_result "Environment files present" "PASS"
else
    test_result "Environment files present" "FAIL"
fi

echo

# File Structure
echo -e "${BLUE}Monitoring System Files${NC}"
echo

FILES=(
    "packages/core/src/monitoring/types.ts"
    "packages/core/src/monitoring/process-registry.ts"
    "packages/core/src/monitoring/zombie-detector.ts"
    "packages/core/src/monitoring/cleanup-manager.ts"
    "packages/core/src/monitoring/health-monitor.ts"
    "packages/core/src/monitoring/alerts.ts"
    "scripts/lib/monitoring/process-tracker.ts"
    "scripts/gates/ops/monitor.ts"
    "apps/cms/src/app/api/health-monitoring/route.ts"
    "apps/cms/src/app/api/health-monitoring/processes/route.ts"
    "apps/dashboard/src/components/SystemHealthPanel.tsx"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        test_result "File exists: $file" "PASS"
    else
        test_result "File exists: $file" "FAIL"
    fi
done

echo

# Scripts Executable
echo -e "${BLUE}Script Permissions${NC}"
echo

SCRIPTS=(
    "scripts/system/apply-ubuntu-updates.sh"
    "scripts/system/verify-system-health.sh"
    "scripts/system/run-verification.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -x "$script" ]; then
        test_result "Executable: $script" "PASS"
    else
        test_result "Executable: $script" "FAIL"
    fi
done

echo

# Package.json Scripts
echo -e "${BLUE}Package.json Scripts${NC}"
echo

PNPM_SCRIPTS=(
    "monitor"
    "monitor:watch"
)

for script in "${PNPM_SCRIPTS[@]}"; do
    if grep -q "\"$script\":" package.json; then
        test_result "Script defined: $script" "PASS"
    else
        test_result "Script defined: $script" "FAIL"
    fi
done

echo

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Verification Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo
echo -e "${GREEN}Passed:${NC}  $PASSED"
echo -e "${RED}Failed:${NC}  $FAILED"
echo -e "${YELLOW}Skipped:${NC} $SKIPPED"
echo

TOTAL=$((PASSED + FAILED + SKIPPED))
if [ "$TOTAL" -gt 0 ]; then
    SUCCESS_RATE=$((PASSED * 100 / TOTAL))
    echo "Success Rate: ${SUCCESS_RATE}%"
fi

echo
if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✓ All automated checks passed!${NC}"
    echo
    echo "Next steps:"
    echo "  1. Review manual checks in verification-checklist.md"
    echo "  2. Run type checking: pnpm typecheck:all"
    echo "  3. Run tests: pnpm test"
    echo "  4. Start dev server: pnpm dev"
    echo "  5. Test monitoring: pnpm monitor:watch"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review and fix.${NC}"
    exit 1
fi
