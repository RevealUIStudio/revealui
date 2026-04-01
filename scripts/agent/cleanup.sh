#!/usr/bin/env bash
# Agent workspace cleanup — safe to run anytime, idempotent.
# Usage: bash scripts/agent/cleanup.sh
#        pnpm agent:cleanup
#
# Optional system cron (weekly):
#   0 3 * * 0 /home/joshua-v-dev/projects/RevealUI/scripts/agent/cleanup.sh

set -euo pipefail

SESSION_DIR="$HOME/.claude/projects/-home-joshua-v-dev-projects-RevealUI"
PLANS_DIR="$HOME/.claude/plans"
WORKBOARD="$HOME/projects/revealui-jv/.claude/workboard.md"

echo "=== Agent Workspace Cleanup ==="

# 1. Prune /tmp agent artifacts older than 24 hours
echo ""
echo "[1/5] Cleaning /tmp agent artifacts (>24h old)..."
count=0
for pattern in "revealui-session-*" "revealui-*" "claude-autocommit-*" "claude-agent-edits-*" "claude-session-*"; do
  found=$(find /tmp -maxdepth 1 -name "$pattern" -mtime +0 2>/dev/null | wc -l)
  if [ "$found" -gt 0 ]; then
    find /tmp -maxdepth 1 -name "$pattern" -mtime +0 -delete 2>/dev/null || true
    count=$((count + found))
  fi
done
echo "  Removed $count temp files"

# 2. Prune session transcript directories older than 14 days, keep 50 most recent
echo ""
echo "[2/5] Pruning session transcripts (>14 days, keep 50 newest)..."
if [ -d "$SESSION_DIR" ]; then
  total=$(find "$SESSION_DIR" -maxdepth 1 -type d ! -path "$SESSION_DIR" 2>/dev/null | wc -l)

  # Skip the memory directory — never prune it
  old_dirs=$(find "$SESSION_DIR" -maxdepth 1 -type d ! -path "$SESSION_DIR" ! -name "memory" -mtime +14 2>/dev/null | sort -t/ -k1 | head -n -50 2>/dev/null || true)
  pruned=0
  for dir in $old_dirs; do
    # Double-check: skip if it contains memory files
    if [ -d "$dir/memory" ]; then
      continue
    fi
    rm -rf "$dir"
    pruned=$((pruned + 1))
  done
  echo "  $total total, pruned $pruned (kept 50 newest + memory)"
else
  echo "  Session directory not found, skipping"
fi

# 3. Prune ephemeral plan files older than 7 days
echo ""
echo "[3/5] Pruning ephemeral plan files (>7 days)..."
if [ -d "$PLANS_DIR" ]; then
  plan_count=$(find "$PLANS_DIR" -maxdepth 1 -name "*.md" -mtime +7 2>/dev/null | wc -l)
  if [ "$plan_count" -gt 0 ]; then
    find "$PLANS_DIR" -maxdepth 1 -name "*.md" -mtime +7 -delete 2>/dev/null || true
  fi
  echo "  Removed $plan_count old plan files"
else
  echo "  Plans directory not found, skipping"
fi

# 4. Trim workboard Recent section to 30 entries
echo ""
echo "[4/5] Trimming workboard Recent section..."
if [ -f "$WORKBOARD" ]; then
  # Count lines in the Recent section (lines starting with "- [")
  in_recent=false
  recent_count=0
  while IFS= read -r line; do
    if [[ "$line" == "## Recent"* ]]; then
      in_recent=true
      continue
    fi
    if $in_recent; then
      if [[ "$line" == "##"* ]]; then
        break
      fi
      if [[ "$line" == "- ["* ]]; then
        recent_count=$((recent_count + 1))
      fi
    fi
  done < "$WORKBOARD"

  if [ "$recent_count" -gt 30 ]; then
    echo "  $recent_count entries found, trimming to 30"
    # Use a temp file to rewrite with trimmed Recent
    tmpfile=$(mktemp)
    in_recent=false
    entry_num=0
    while IFS= read -r line; do
      if [[ "$line" == "## Recent"* ]]; then
        in_recent=true
        echo "$line" >> "$tmpfile"
        continue
      fi
      if $in_recent; then
        if [[ "$line" == "##"* ]]; then
          in_recent=false
          echo "$line" >> "$tmpfile"
          continue
        fi
        if [[ "$line" == "- ["* ]]; then
          entry_num=$((entry_num + 1))
          if [ "$entry_num" -le 30 ]; then
            echo "$line" >> "$tmpfile"
          fi
          continue
        fi
        # Preserve non-entry lines (blanks, etc.) only within the first 30
        if [ "$entry_num" -le 30 ]; then
          echo "$line" >> "$tmpfile"
        fi
      else
        echo "$line" >> "$tmpfile"
      fi
    done < "$WORKBOARD"
    mv "$tmpfile" "$WORKBOARD"
  else
    echo "  $recent_count entries (within limit)"
  fi
else
  echo "  Workboard not found, skipping"
fi

# 5. Report disk usage
echo ""
echo "[5/5] Disk usage summary:"
if [ -d "$SESSION_DIR" ]; then
  session_size=$(du -sh "$SESSION_DIR" 2>/dev/null | cut -f1)
  session_count=$(find "$SESSION_DIR" -maxdepth 1 -type d ! -path "$SESSION_DIR" 2>/dev/null | wc -l)
  echo "  Sessions: $session_size ($session_count directories)"
fi
if [ -d "$PLANS_DIR" ]; then
  plan_remaining=$(find "$PLANS_DIR" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)
  echo "  Plans: $plan_remaining files"
fi
tmp_remaining=$(find /tmp -maxdepth 1 \( -name "revealui-*" -o -name "claude-*" \) 2>/dev/null | wc -l)
echo "  /tmp agent files: $tmp_remaining remaining"

echo ""
echo "=== Cleanup complete ==="
