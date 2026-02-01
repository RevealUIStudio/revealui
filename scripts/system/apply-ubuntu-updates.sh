#!/bin/bash

###############################################################################
# Ubuntu System Updates - Staged Approach
#
# This script applies Ubuntu updates in a safe, staged manner:
# 1. System libraries (libc, linux-libc-dev)
# 2. Ubuntu metapackages
# 3. Services (snapd)
# 4. Node.js (if needed)
#
# Each stage is followed by verification to ensure stability.
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Ubuntu System Updates - Staged Approach${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo

# Function to print step header
print_step() {
    echo
    echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"
}

# Function to verify step
verify_step() {
    echo -e "${GREEN}✓ Step completed successfully${NC}"
    echo -e "${YELLOW}Press Enter to continue to next stage, or Ctrl+C to abort...${NC}"
    read -r
}

# Update package lists
print_step "Step 0: Updating package lists"
sudo apt update
verify_step

# Stage 1: System Libraries
print_step "Stage 1: System Libraries"
echo "Updating: libc-bin, libc6, libc6-dev, libc-dev-bin, locales, linux-libc-dev"
echo
sudo apt install --only-upgrade -y \
    libc-bin \
    libc6 \
    libc6-dev \
    libc-dev-bin \
    locales \
    linux-libc-dev

echo
echo -e "${GREEN}✓ System libraries updated${NC}"
verify_step

# Stage 2: Ubuntu Metapackages
print_step "Stage 2: Ubuntu Metapackages"
echo "Updating: ubuntu-minimal, ubuntu-server, ubuntu-standard, ubuntu-wsl"
echo
sudo apt install --only-upgrade -y \
    ubuntu-minimal \
    ubuntu-server \
    ubuntu-standard \
    ubuntu-wsl

echo
echo -e "${GREEN}✓ Ubuntu metapackages updated${NC}"
verify_step

# Stage 3: Services
print_step "Stage 3: Services"
echo "Updating: snapd"
echo
sudo apt install --only-upgrade -y snapd

echo
echo -e "${GREEN}✓ Services updated${NC}"
verify_step

# Stage 4: Node.js (if needed)
print_step "Stage 4: Node.js Version Check"
CURRENT_NODE=$(node --version)
echo "Current Node.js version: $CURRENT_NODE"

if [ "$CURRENT_NODE" = "v24.13.0" ]; then
    echo -e "${GREEN}✓ Node.js is already at v24.13.0${NC}"
else
    echo "Node.js update available"
    echo -e "${YELLOW}Updating Node.js...${NC}"
    sudo apt install --only-upgrade -y nodejs

    echo
    NEW_NODE=$(node --version)
    echo "New Node.js version: $NEW_NODE"
    echo -e "${GREEN}✓ Node.js updated${NC}"
fi

verify_step

# Final Verification
print_step "Final Verification"

echo "Verifying Node.js..."
node --version

echo
echo "Verifying pnpm..."
cd ~/projects/RevealUI
pnpm --version

echo
echo "Verifying project dependencies..."
pnpm install --frozen-lockfile

echo
echo "Running type check..."
pnpm typecheck:all

echo
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✓ All updates completed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo
echo "Summary:"
echo "  - System libraries: Updated"
echo "  - Ubuntu metapackages: Updated"
echo "  - Services (snapd): Updated"
echo "  - Node.js: $(node --version)"
echo "  - Dependencies: Verified"
echo "  - Type checking: Passed"
echo
echo "You can now run 'pnpm dev' to start development."
