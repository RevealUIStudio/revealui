#!/usr/bin/env bash
# Assemble a flat seed directory for RevealUIStudio/revealui-starter-kit.
# Owner runs the git init/push steps in OWNER-LAUNCH.md (M-11 escape hatch).
set -euo pipefail

SOURCE=""
OUT=""

usage() {
  echo "usage: $0 --source <examples/starter-kit> --out <seed-dir>" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

[[ -n "$SOURCE" && -n "$OUT" ]] || usage
[[ -f "$SOURCE/package.json" ]] || {
  echo "error: --source must be the kit root (package.json missing): $SOURCE" >&2
  exit 1
}

rm -rf "$OUT"
mkdir -p "$OUT"

# Flat copy: private repo root == kit root (npm-resolvable, no monorepo parent).
# Monorepo-only operator files stay out of the buyer tree.
rsync -a \
  --exclude node_modules \
  --exclude .turbo \
  --exclude dist \
  --exclude 'receipt-*.json' \
  --exclude .env \
  --exclude .env.local \
  --exclude OWNER-LAUNCH.md \
  --exclude scripts/assemble-private-seed.sh \
  "$SOURCE"/ "$OUT"/

# Buyer-facing README at private root.
if [[ -f "$OUT/GETTING-STARTED.md" ]]; then
  {
    echo '# RevealUI Starter Kit'
    echo
    echo 'Purchase delivery tree for the $299 content-only kit (GAP-434).'
    echo 'Start here: [GETTING-STARTED.md](./GETTING-STARTED.md).'
    echo
    echo 'This repository is private. Do not republish kit contents.'
  } >"$OUT/README.md"
fi

# Belt-and-suspenders if rsync exclude was skipped by an older call site.
rm -f "$OUT/OWNER-LAUNCH.md" "$OUT/scripts/assemble-private-seed.sh"

echo "seed ready: $OUT"
echo "next: see examples/starter-kit/OWNER-LAUNCH.md §1 (owner shell)"
