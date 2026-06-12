#!/usr/bin/env bash
# audit-vercel-env-types.sh — verify every sync-manifest entry marked
# `sensitive = true` is actually type=sensitive on Vercel.
#
# Vercel distinguishes `encrypted` env vars (any project member can reveal
# the plaintext in the dashboard) from `sensitive` (write-only after create).
# The sync manifest declares which vars must be sensitive; this audit checks
# the live production rows against those declarations and fails loudly on
# any downgrade.
#
# Read-only: requests env metadata (key + type) only — never values (no
# decrypt parameter), and never prints secrets. The Vercel API token is read
# from revvault at revealui/prod/api-keys/vercel-token.
#
# Usage (from the repo root):
#   bash scripts/audit-vercel-env-types.sh [path/to/revvault-vercel.toml]
#
# Exit code: 0 when every marked entry is sensitive (absent rows report as
# WARN — the marker is create-only and dormant until the var exists);
# otherwise the number of FAIL rows.
#
# Parsing uses bash case globs + parameter expansion + jq only (no regex,
# per the fleet no-regex posture).
set -euo pipefail

MANIFEST="${1:-scripts/sync/revvault-vercel.toml}"
[ -f "$MANIFEST" ] || { echo "FATAL: manifest not found: $MANIFEST (run from the repo root)"; exit 1; }

TOKEN=$(revvault --json get revealui/prod/api-keys/vercel-token | jq -r '.value // empty')
[ -n "$TOKEN" ] || { echo "FATAL: vercel token not found in vault"; exit 1; }

# ── Parse the manifest: section slug -> project_id, plus the marked entries ──
declare -A PROJECT_IDS=()
MARKED=() # "slug NAME" pairs
slug=""
while IFS= read -r line; do
  read -r first _ <<< "$line" || true
  case "$first" in "" | "#"*) continue ;; esac
  case "$line" in
    *"[projects."*)
      rest="${line#*\[projects.}"
      s="${rest%%]*}"
      slug="${s%.vars}"
      continue
      ;;
  esac
  case "$first" in
    project_id)
      read -r _ _ val _ <<< "$line"
      val="${val%\"}"
      val="${val#\"}"
      [ -n "$slug" ] && PROJECT_IDS[$slug]="$val"
      ;;
    *)
      case "$line" in
        *"sensitive = true"*)
          [ -n "$slug" ] && MARKED+=("$slug $first")
          ;;
      esac
      ;;
  esac
done < "$MANIFEST"

if [ "${#MARKED[@]}" -eq 0 ]; then
  echo "No 'sensitive = true' entries found in $MANIFEST — nothing to audit"
  exit 0
fi

# ── Check each marked entry against its project's production rows ──────────
declare -A ENVS=()
fails=0
warns=0
passes=0
for entry in "${MARKED[@]}"; do
  read -r s name <<< "$entry"
  pid="${PROJECT_IDS[$s]:-}"
  if [ -z "$pid" ]; then
    echo "FAIL $s/$name: no project_id parsed for manifest section"
    fails=$((fails + 1))
    continue
  fi
  if [ -z "${ENVS[$pid]:-}" ]; then
    ENVS[$pid]=$(curl -sf -H "Authorization: Bearer $TOKEN" \
      "https://api.vercel.com/v9/projects/$pid/env") || {
      echo "FATAL: env list fetch failed for project $s"
      exit 1
    }
  fi
  types=$(printf '%s' "${ENVS[$pid]}" | jq -r --arg n "$name" \
    '[.envs[] | select(.key == $n and ((.target // []) | index("production"))) | .type] | if length == 0 then "MISSING" else unique | join(",") end')
  case "$types" in
    sensitive)
      echo "PASS $s/$name: type=sensitive"
      passes=$((passes + 1))
      ;;
    MISSING)
      echo "WARN $s/$name: no production row (marker is create-only; dormant)"
      warns=$((warns + 1))
      ;;
    *)
      echo "FAIL $s/$name: type=$types (manifest marks it sensitive)"
      fails=$((fails + 1))
      ;;
  esac
done

echo "---"
echo "checked=${#MARKED[@]} pass=$passes warn-missing=$warns fail=$fails"
exit "$fails"
