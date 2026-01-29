#!/bin/bash
set -e

echo "Starting Antigravity WSL Fix..."

# Auto-detect Windows username
if [ -n "$LOGNAME" ]; then
    WIN_USER="$LOGNAME"
elif command -v cmd.exe &> /dev/null; then
    WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r\n')
else
    # Fallback: try to detect from /mnt/c/Users
    WIN_USER=$(ls /mnt/c/Users 2>/dev/null | grep -v -E '^(Public|Default|All Users|Default User)$' | head -1)
fi

if [ -z "$WIN_USER" ]; then
    echo "ERROR: Could not auto-detect Windows username."
    echo "Please set WIN_USER environment variable manually:"
    echo "  WIN_USER=yourusername ./scripts/agent/fix_antigravity.sh"
    exit 1
fi

echo "Detected Windows user: $WIN_USER"

# Configuration
ANTIGRAVITY_BASE="/mnt/c/Users/${WIN_USER}/AppData/Local/Programs/Antigravity"
EXT_SCRIPTS_DIR="${ANTIGRAVITY_BASE}/resources/app/extensions/antigravity-remote-wsl/scripts"
LAUNCHER_FILE="${ANTIGRAVITY_BASE}/bin/antigravity"
TEMP_DIR=$(mktemp -d)
VSIX_URL="https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-vscode-remote/vsextensions/remote-wsl/0.81.8/vspackage"

# Verify Antigravity installation exists
if [ ! -d "$ANTIGRAVITY_BASE" ]; then
    echo "ERROR: Antigravity installation not found at $ANTIGRAVITY_BASE"
    echo "Make sure Antigravity is installed for user: $WIN_USER"
    exit 1
fi

echo "Working directory: ${TEMP_DIR}"

# Cleanup function
cleanup() {
    rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

# 1. Download and Extract VSIX
echo "Downloading Remote-WSL extension..."
if ! curl -L --compressed -k -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" -o "${TEMP_DIR}/remote-wsl.zip" "${VSIX_URL}"; then
    echo "Failed to download extension."
    exit 1
fi

echo "Verifying download..."
file "${TEMP_DIR}/remote-wsl.zip"

echo "Extracting extension..."
if ! unzip -q "${TEMP_DIR}/remote-wsl.zip" -d "${TEMP_DIR}/ext"; then
    echo "Unzip failed. Attempting fallback for double-compressed files..."
    mv "${TEMP_DIR}/remote-wsl.zip" "${TEMP_DIR}/remote-wsl.gz"
    gunzip "${TEMP_DIR}/remote-wsl.gz"
    mv "${TEMP_DIR}/remote-wsl" "${TEMP_DIR}/remote-wsl.zip"

    if ! unzip -q "${TEMP_DIR}/remote-wsl.zip" -d "${TEMP_DIR}/ext"; then
        echo "Failed to unzip extension. Please verify internet connectivity."
        file "${TEMP_DIR}/remote-wsl.zip"
        exit 1
    fi
fi

# 2. Deploy Scripts
echo "Deploying scripts to: ${EXT_SCRIPTS_DIR}"
mkdir -p "${EXT_SCRIPTS_DIR}"
cp -v "${TEMP_DIR}/ext/extension/scripts/"* "${EXT_SCRIPTS_DIR}/"

# 3. Patch Launcher
echo "Patching launcher: ${LAUNCHER_FILE}"
if [ -f "${LAUNCHER_FILE}" ]; then
    # Create backup with timestamp
    cp "${LAUNCHER_FILE}" "${LAUNCHER_FILE}.bak.$(date +%s)"

    # Replace ID using perl for cross-platform compatibility
    perl -pi -e 's/WSL_EXT_ID="ms-vscode-remote.remote-wsl"/WSL_EXT_ID="google.antigravity-remote-wsl"/g' "${LAUNCHER_FILE}"

    echo "Launcher patched."
else
    echo "ERROR: Launcher file not found at ${LAUNCHER_FILE}"
    exit 1
fi

echo ""
echo "SUCCESS! Antigravity configuration updated."
echo "Please restart Antigravity and try connecting to WSL."
