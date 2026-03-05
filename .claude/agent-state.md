# Agent State — Cross-Session Decision Log

This file persists across session restarts (unlike the workboard).
Add entries here for architectural decisions that future sessions need to understand.

**Format:** `- [YYYY-MM-DD HH:MM] agent-id: decision made and why`

**Gitignored** — do not commit. Ephemeral coordination artifact.

## Active Sessions

| role | started | last-seen | task |
| ---- | ------- | --------- | ---- |

## Decisions

- [2026-03-04 12:00] terminal-1: Established 3-agent coordination system. Identity via CLAUDE_AGENT_ROLE env var. revealui-studio tmux script for wsl-root + revealui-terminal. .envrc exports zed-revealui. workboard-update.js uses ppid-scoped /tmp files to prevent session ID collision across 3 agents.
