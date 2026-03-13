#!/bin/bash
# Sync Pro packages from RevealUI (development) to revealui-jv (archive)
# Run manually when Pro package code changes significantly
set -euo pipefail

REVEALUI="$HOME/projects/RevealUI"
JV="$HOME/projects/revealui-jv"
PRO_PACKAGES=(ai mcp editors services harnesses)

for pkg in "${PRO_PACKAGES[@]}"; do
  src="$REVEALUI/packages/$pkg/"
  dst="$JV/packages/$pkg/"
  if [ -d "$src" ]; then
    rsync -av --delete --exclude='node_modules' --exclude='dist' --exclude='.turbo' "$src" "$dst"
  fi
done

cd "$JV"
git add packages/ai packages/mcp packages/editors packages/services packages/harnesses
git diff --cached --quiet && echo "No Pro changes to commit." && exit 0
git commit -m "chore(pro): sync Pro packages from RevealUI"
echo "Pro packages synced. Run 'git push origin main' when ready."
