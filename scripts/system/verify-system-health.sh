#!/bin/bash

###############################################################################
# System Health Verification Script
#
# Checks system state, available updates, zombie processes, and project health
# without requiring sudo access.
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   System Health Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo

# Check Node.js version
echo -e "${BLUE}Node.js Version:${NC}"
node --version
echo

# Check pnpm version
echo -e "${BLUE}pnpm Version:${NC}"
pnpm --version
echo

# Check for zombie processes
echo -e "${BLUE}Zombie Processes:${NC}"
ZOMBIES=$(ps aux | grep -E ' (Z|z) ' | grep -v grep || echo "")
if [ -z "$ZOMBIES" ]; then
    echo -e "${GREEN}✓ No zombie processes detected${NC}"
else
    echo -e "${RED}⚠ Zombie processes detected:${NC}"
    echo "$ZOMBIES"
fi
echo

# Check for available updates
echo -e "${BLUE}Available Ubuntu Updates:${NC}"
UPDATE_COUNT=$(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l)
if [ "$UPDATE_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ System is up to date${NC}"
else
    echo -e "${YELLOW}$UPDATE_COUNT updates available${NC}"
    echo
    echo "To see details, run: apt list --upgradable"
    echo "To apply updates, run: ./scripts/system/apply-ubuntu-updates.sh"
fi
echo

# Check system resources
echo -e "${BLUE}System Resources:${NC}"
echo "Memory:"
free -h | grep -E "^Mem|^Swap"
echo
echo "Disk:"
df -h / | grep -v Filesystem
echo

# Check process count
echo -e "${BLUE}Process Statistics:${NC}"
TOTAL_PROCS=$(ps aux | wc -l)
echo "Total processes: $TOTAL_PROCS"
echo

# Check if in RevealUI directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}⚠ Not in RevealUI project directory${NC}"
    echo "Please run this script from the RevealUI root directory"
    exit 1
fi

# Check project dependencies
echo -e "${BLUE}Project Health:${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ node_modules not found - run 'pnpm install'${NC}"
else
    echo -e "${GREEN}✓ node_modules present${NC}"
fi
echo

# Check for common issues
echo -e "${BLUE}Common Issues Check:${NC}"

# Check for .env file
if [ -f ".env" ] || [ -f ".env.local" ]; then
    echo -e "${GREEN}✓ Environment files present${NC}"
else
    echo -e "${YELLOW}⚠ No .env files found${NC}"
fi

# Check database connection (if env vars are set)
if [ -n "$DATABASE_URL" ] || [ -n "$POSTGRES_URL" ]; then
    echo -e "${GREEN}✓ Database environment variables set${NC}"
else
    echo -e "${YELLOW}⚠ Database environment variables not set${NC}"
fi

echo
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Verification Complete${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo

# Summary
if [ "$UPDATE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Action Required: $UPDATE_COUNT system updates available${NC}"
    echo "Run: ./scripts/system/apply-ubuntu-updates.sh"
fi

if [ -n "$ZOMBIES" ]; then
    echo -e "${RED}Action Required: Zombie processes detected${NC}"
    echo "Run: pnpm monitor to investigate"
fi

echo
echo "To start development:"
echo "  pnpm dev"
echo
echo "To monitor system health:"
echo "  pnpm monitor"
echo "  pnpm monitor:watch"
