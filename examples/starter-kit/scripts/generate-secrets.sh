#!/usr/bin/env bash
# Generate every secret docker-compose.starter.yml needs and print them as
# .env-format lines. Usage:
#
#   bash scripts/generate-secrets.sh > secrets.env
#   cat secrets.env  # review, then paste the values into .env
#
# Or pipe straight into .env (only if .env doesn't already have real values —
# this does NOT merge, it just prints new lines):
#
#   bash scripts/generate-secrets.sh >> .env
#
# Requires: openssl (present on macOS/Linux by default; on Windows use WSL
# or Git Bash with openssl installed).
set -euo pipefail

# Every value below is single-quoted. This is not cosmetic: the PEM value
# contains spaces in its armor lines, and an unquoted .env line makes
# `source .env` (which scripts/bootstrap.sh and most dev workflows do) try to
# run part of the armor as a command and abort. Single quotes are safe here
# because none of these values can contain a single quote (hex digits and
# base64 PEM only).
echo "POSTGRES_PASSWORD='$(openssl rand -hex 24)'"
echo "REVEALUI_SECRET='$(openssl rand -hex 32)'"
echo "REVEALUI_KEK='$(openssl rand -hex 32)'"

# Ed25519 signing key for the audit log — REVEALUI_AUDIT_SIGNING_KEY needs the
# full PEM, so a temp file round-trip is simpler than shelling out to sed.
tmp_key="$(mktemp)"
trap 'rm -f "$tmp_key"' EXIT
openssl genpkey -algorithm Ed25519 -out "$tmp_key" 2>/dev/null
# Fold real newlines into \n so the value is a single .env line.
key_escaped="$(awk '{printf "%s\\n", $0}' "$tmp_key")"
echo "REVEALUI_AUDIT_SIGNING_KEY='${key_escaped}'"

echo "REVEALUI_ADMIN_PASSWORD='$(openssl rand -hex 16)'"

echo "# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ). Rotate REVEALUI_ADMIN_PASSWORD after your first login." >&2
