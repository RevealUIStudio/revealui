#!/usr/bin/env bash
# check-client-leaks.sh
#
# Scans the repo for any reference to a RevealUI Studio client,
# prospect, or warm-intro contact. Customer/prospect names belong in the
# private internal repo only, never in this public surface.
#
# Exit 0 on clean. Exit 1 on any violation. Exit 2 on tool/setup error
# (including a missing pattern list: this scanner fails closed).
#
# Usage:
#   bash scripts/check-client-leaks.sh                     # scan repo root
#   bash scripts/check-client-leaks.sh <path> [<path>...]  # scan specific paths
#   LEAK_JSON=1 bash scripts/check-client-leaks.sh         # machine-readable
#
# CI wiring: .github/workflows/check-client-leaks.yml
# REQUIRED status check on `test` and `main` branch protection.
#
# Pattern list (one line per entry: tag|literal|reason):
#   CI loads CLIENT_LEAK_PATTERNS (org Actions secret). Empty or missing
#   fails closed so a missing secret cannot look like a clean scan.
#   Locally, CLIENT_LEAK_PATTERNS wins when set. Otherwise a gitignored
#   .client-name-watchlist.local at the repo root is the fallback.
#   Add a line to the CLIENT_LEAK_PATTERNS org secret (never to a
#   committed file). There is no .leakignore for this scanner: the
#   property must be unconditional.
#
# Lines that are blank or start with # are ignored. Do not quote the line.

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

# Literals are consumed by grep -F (fixed strings). No regex authored.

in_ci=0
if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  in_ci=1
fi

is_blank() {
  local text="$1"
  local stripped="${text//[[:space:]]/}"
  [[ -z "$stripped" ]]
}

fail_closed_missing() {
  echo "[client-leak] error: CLIENT_LEAK_PATTERNS is empty or unset. CI refuses to pass without the CLIENT_LEAK_PATTERNS org secret (one tag|literal|reason line per line)." >&2
  exit 2
}

parse_patterns() {
  local text="$1"
  local line trimmed tag after_tag literal
  local index=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    trimmed="${line#"${line%%[![:space:]]*}"}"
    trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
    if [[ -z "$trimmed" || "${trimmed:0:1}" == "#" ]]; then
      continue
    fi
    index=$((index + 1))
    tag="${trimmed%%|*}"
    if [[ "$tag" == "$trimmed" ]]; then
      echo "[client-leak] error: malformed pattern entry ${index}; expected tag|literal|reason. Refusing to scan." >&2
      exit 2
    fi
    after_tag="${trimmed#*|}"
    literal="${after_tag%%|*}"
    if [[ "$literal" == "$after_tag" ]]; then
      echo "[client-leak] error: malformed pattern entry ${index}; expected tag|literal|reason. Refusing to scan." >&2
      exit 2
    fi
    if [[ -z "$tag" || -z "$literal" ]]; then
      echo "[client-leak] error: malformed pattern entry ${index}; tag and literal must be non-empty. Refusing to scan." >&2
      exit 2
    fi
    PATTERNS+=("$trimmed")
  done <<< "$text"
}

PATTERNS=()
pattern_text=""
pattern_source=""
have_env=0

if [[ -n "${CLIENT_LEAK_PATTERNS+x}" ]]; then
  if ! is_blank "${CLIENT_LEAK_PATTERNS}"; then
    have_env=1
  fi
fi

if (( have_env )); then
  pattern_text="${CLIENT_LEAK_PATTERNS}"
  pattern_source="CLIENT_LEAK_PATTERNS"
elif (( in_ci )); then
  fail_closed_missing
else
  watchlist="${REPO_ROOT}/.client-name-watchlist.local"
  if [[ -f "$watchlist" && -r "$watchlist" ]]; then
    pattern_text="$(<"$watchlist")"
    pattern_source=".client-name-watchlist.local"
  else
    echo "[client-leak] warning: no pattern list loaded. Set CLIENT_LEAK_PATTERNS or add a gitignored .client-name-watchlist.local (one tag|literal|reason line per line). Refusing to report a clean scan." >&2
    exit 2
  fi
fi

parse_patterns "$pattern_text"
unset pattern_text

if [[ ${#PATTERNS[@]} -eq 0 ]]; then
  if (( in_ci )); then
    fail_closed_missing
  fi
  echo "[client-leak] warning: ${pattern_source} produced no pattern lines. Refusing to report a clean scan." >&2
  exit 2
fi
unset pattern_source

# Directories / file globs to skip
EXCLUDE_DIRS=(node_modules .git dist build .next .turbo .pnpm coverage target .direnv .nyc_output playwright-report test-results)
EXCLUDE_FILES=(
  pnpm-lock.yaml package-lock.json yarn.lock Cargo.lock
  # Local pattern source. It holds the literal list by design and is gitignored.
  .client-name-watchlist.local
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
      printf '[CLIENT-LEAK:%s] %s:%s: %s\n  > %s\n' "$tag" "$file" "$line" "$reason" "$content"
    fi
    violations=$((violations + 1))
  done < <(grep -rFIn "${grep_excludes[@]}" -- "$pattern" "${SCAN_PATHS[@]}" 2>/dev/null || true)
done

if [[ -n "${LEAK_JSON:-}" ]]; then
  printf '{"violations":%d,"entries":[%s]}\n' "$violations" "$(IFS=,; echo "${json_entries[*]:-}")"
fi

if (( violations > 0 )); then
  if [[ -z "${LEAK_JSON:-}" ]]; then
    echo "" >&2
    echo "[client-leak] FAIL: ${violations} violation(s)." >&2
    echo "" >&2
    echo "Customer / prospect names must NEVER appear in this public-facing repo." >&2
    echo "Move the content to the private internal repo (or genericize with a" >&2
    echo "placeholder like 'Acme Corp' / 'acme' / 'first customer')." >&2
    echo "" >&2
    echo "If a new client, prospect, or contact needs scanner coverage, add" >&2
    echo "the line to the CLIENT_LEAK_PATTERNS org secret (never to a committed file)." >&2
  fi
  exit 1
fi

[[ -z "${LEAK_JSON:-}" ]] && echo "[client-leak] OK: no client/prospect names detected across: ${SCAN_PATHS[*]}"
exit 0
