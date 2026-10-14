#!/usr/bin/env bash
# Gates finish before Git opens transport. The hook verifies live admission.
# Usage: pnpm push [target-branch [remote]]
set -euo pipefail
{
if [ "$#" -gt 2 ]; then
  echo "Expected pnpm push [target-branch [remote]]." >&2
  exit 1
fi
# Check before any Node process starts; a preload can replace the owner logic.
if [ -n "${NODE_OPTIONS:-}" ] || [ -n "${BASH_ENV:-}" ] || [ -n "${ENV:-}" ]; then
  echo "Push denied: Node or shell startup injection is unsupported for push admission." >&2
  exit 1
fi
ROOT=$(git rev-parse --show-toplevel)
ROOT=$(cd -- "$ROOT" && pwd -P)
BRANCH=$(git symbolic-ref --quiet --short HEAD)
TARGET="${1:-$BRANCH}"
REMOTE="${2:-origin}"
SCRIPT="$ROOT/scripts/git-hooks/push.sh"
# Fixed privileged Bash ignores BASH_ENV/ENV, inherited functions and shell
# options. Its live kernel executable and exact NUL-delimited argv are the
# provenance boundary, rather than a Node process's mutable display title.
if [[ "$-" != *p* ]] || [ "$0" != "$SCRIPT" ] || [ "$#" -ne 2 ]; then
  exec /bin/bash -p "$SCRIPT" "$TARGET" "$REMOTE"
fi
NODE=$(command -v node)
NODE=$("$NODE" -p 'process.execPath')
PUSH_CHILD_PID=""
PUSH_INTERRUPTED=0
forward_interrupt() { PUSH_INTERRUPTED=1; [ -z "$PUSH_CHILD_PID" ] || kill -INT "$PUSH_CHILD_PID" 2>/dev/null || true; }
forward_termination() { PUSH_INTERRUPTED=1; [ -z "$PUSH_CHILD_PID" ] || kill -TERM "$PUSH_CHILD_PID" 2>/dev/null || true; }
trap forward_interrupt INT
trap forward_termination TERM
# Remain alive while the owner and Git run. The hook proves this exact parent.
"$NODE" "$ROOT/scripts/git-hooks/push-admission.cjs" owner "$TARGET" "$REMOTE" <&0 &
PUSH_CHILD_PID=$!
if [ "$PUSH_INTERRUPTED" -eq 1 ]; then
  kill -TERM "$PUSH_CHILD_PID" 2>/dev/null || true
fi
if wait "$PUSH_CHILD_PID"; then
  PUSH_CHILD_PID=""
  [ "$PUSH_INTERRUPTED" -eq 0 ] || exit 1
  exit 0
else
  PUSH_STATUS=$?
  PUSH_CHILD_PID=""
  exit "$PUSH_STATUS"
fi
}
