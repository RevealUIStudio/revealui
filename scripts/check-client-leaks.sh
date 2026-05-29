#!/usr/bin/env bash
# check-client-leaks.sh
#
# Scans the repo for any reference to a specific RevealUI Studio client,
# prospect, or warm-intro contact. Customer/prospect names belong in the
# private internal repo only — never in this public surface, ever.
#
# Exit 0 on clean. Exit 1 on any violation. Exit 2 on tool/setup error.
#
# Usage:
#   bash scripts/check-client-leaks.sh                     # scan repo root
#   bash scripts/check-client-leaks.sh <path> [<path>...]  # scan specific paths
#   LEAK_JSON=1 bash scripts/check-client-leaks.sh         # machine-readable
#
# CI wiring: .github/workflows/check-client-leaks.yml
# REQUIRED status check on `test` and `main` branch protection.
#
# Adding a new client / prospect / contact:
#   Append one line to PATTERNS below (format: tag|literal-string|reason).
#   Then open a PR; CI will refuse to merge any tracked file that contains
#   the name, today and forever. There is no .leakignore for this scanner —
#   the property must be unconditional.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_PATHS=("$@")
[[ ${#SCAN_PATHS[@]} -eq 0 ]] && SCAN_PATHS=("$REPO_ROOT")

for _path in "${SCAN_PATHS[@]}"; do
  if [[ ! -e "$_path" ]]; then
    echo "[client-leak] error: scan path not found: $_path" >&2
    exit 2
  fi
done
unset _path

# --- Patterns: tag | literal-string | reason ---
#
# REGEX-CONFIG-BOUNDARY: the strings consumed by grep -F (fixed strings),
# so each pattern is a literal substring — no metacharacter handling.
# No regex authored.
#
# To add a new client / prospect, append a line. Coverage MUST land in
# the same PR that introduces them to the operator's pipeline.
PATTERNS=(
  # --- Allevia Technology (Tier-6 first customer; owner directive 2026-05-21:
  #     no public Allevia anywhere; internal coordination repo OK; never
  #     public repos. See the project_allevia_internal_only memory entry.)
  "client-allevia|Allevia|customer name (Allevia)"
  "client-allevia-lower|allevia|customer slug (allevia)"
  "client-alleviafleet|AlleviaFleet|customer brand instance (AlleviaFleet)"
  "client-alleviaforge|AlleviaForge|customer brand instance (AlleviaForge, superseded by *Fleet)"
  "client-allevia-host|allevia.tech|customer domain (allevia.tech)"
  # --- Warm-intro contact chain — these are the human introduction path
  #     and must never appear in public material per memory
  #     feedback_warm_intro_dont_bypass + project_allevia_contacts
  "prospect-stefan|Stefan Wilson|prospect contact (Stefan Wilson, customer CEO)"
  "prospect-daniel-name|Daniel B. Jones|prospect warm-intro contact (Daniel B. Jones)"
  "prospect-daniel-handle|dbjones23|prospect warm-intro email handle (dbjones23)"
  # --- Other internal ventures the operator does not publicly associate with
  #     this org (paused or undisclosed)
  "venture-biotix|Biotix Wellness|paused internal venture (Biotix Wellness)"
  "venture-biotix-lower|biotix-wellness|paused internal venture (slug form)"
)

# Directories / file globs to skip
EXCLUDE_DIRS=(node_modules .git dist build .next .turbo .pnpm coverage target .direnv .nyc_output playwright-report test-results)
EXCLUDE_FILES=(
  pnpm-lock.yaml package-lock.json yarn.lock Cargo.lock
  check-client-leaks.sh
  # Companion gitleaks rule file. By design it carries the same names
  # as detection keywords (boundary-config per the no-regex rule's
  # third-party-config exception); the bash scanner must NOT count
  # those keywords as violations of itself. Scanner-self-pattern.
  .gitleaks.issues.toml
  CHANGELOG.md
  '*.png' '*.jpg' '*.jpeg' '*.gif' '*.webp' '*.pdf' '*.zip' '*.tar.gz' '*.tgz'
  '*.ico' '*.woff' '*.woff2' '*.ttf' '*.otf'
  '*.har' '*.snap'
)

if ! command -v grep >/dev/null 2>&1; then
  echo "[client-leak] error: grep not found on PATH" >&2
  exit 2
fi

grep_excludes=()
for d in "${EXCLUDE_DIRS[@]}"; do
  grep_excludes+=(--exclude-dir="$d")
done
for f in "${EXCLUDE_FILES[@]}"; do
  grep_excludes+=(--exclude="$f")
done

violations=0
json_entries=()

for entry in "${PATTERNS[@]}"; do
  tag="${entry%%|*}"
  rest="${entry#*|}"
  pattern="${rest%%|*}"
  reason="${rest#*|}"

  while IFS= read -r hit; do
    [[ -z "$hit" ]] && continue
    file="${hit%%:*}"
    rest_="${hit#*:}"
    line="${rest_%%:*}"
    content="${rest_#*:}"

    if [[ -n "${LEAK_JSON:-}" ]]; then
      if command -v jq >/dev/null 2>&1; then
        json_entries+=("$(jq -cn --arg tag "$tag" --arg file "$file" --arg line "$line" --arg reason "$reason" --arg content "$content" \
          '{tag:$tag, file:$file, line:($line|tonumber), reason:$reason, content:$content}')")
      else
        safe="${content//\\/\\\\}"
        safe="${safe//\"/\\\"}"
        safe="${safe//$'\n'/\\n}"
        safe="${safe//$'\t'/\\t}"
        sreason="${reason//\\/\\\\}"
        sreason="${sreason//\"/\\\"}"
        json_entries+=("{\"tag\":\"$tag\",\"file\":\"$file\",\"line\":$line,\"reason\":\"$sreason\",\"content\":\"$safe\"}")
      fi
    else
      printf '[CLIENT-LEAK:%s] %s:%s — %s\n  → %s\n' "$tag" "$file" "$line" "$reason" "$content"
    fi
    violations=$((violations+1))
  done < <(grep -rFIn "${grep_excludes[@]}" -- "$pattern" "${SCAN_PATHS[@]}" 2>/dev/null || true)
done

if [[ -n "${LEAK_JSON:-}" ]]; then
  printf '{"violations":%d,"entries":[%s]}\n' "$violations" "$(IFS=,; echo "${json_entries[*]:-}")"
fi

if (( violations > 0 )); then
  if [[ -z "${LEAK_JSON:-}" ]]; then
    echo "" >&2
    echo "[client-leak] FAIL — $violations violation(s)." >&2
    echo "" >&2
    echo "Customer / prospect names must NEVER appear in this public-facing repo." >&2
    echo "Move the content to the private internal repo (or genericize with a" >&2
    echo "placeholder like 'Acme Corp' / 'acme' / 'first customer')." >&2
    echo "" >&2
    echo "If a new client onboards and their name needs scanner coverage, add" >&2
    echo "the pattern lines to scripts/check-client-leaks.sh PATTERNS array in" >&2
    echo "the same PR." >&2
  fi
  exit 1
fi

[[ -z "${LEAK_JSON:-}" ]] && echo "[client-leak] OK — no client/prospect names detected across: ${SCAN_PATHS[*]}"
exit 0
