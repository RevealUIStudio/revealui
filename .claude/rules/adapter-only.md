# Adapter Only (no dual-home mirrors)

Claude Code, Grok, Cursor, OpenCode, VS Code, and product agents are **adapters**.
Shared policy, product tools, coordination, and day-to-day backlog live in the
RevealUI native layer. Adapters communicate with that layer; they do not re-author
shared hardlines.

## Authority order

1. **Project manager** — `./.revealui/manager.json` (+ `.revealui/content/`)
2. **Package definitions** — `@revealui/harnesses` content definitions (this rule set)
3. **Fleet TRACKER** — free-surface board (`docs/TRACKER.md` / private planning tree)
4. **Adapter homes** — thin pointers, vendor tool names, TUI ops only

## Rules

1. **No new full hardline body** under vendor homes (`~/.claude/rules` forks of
   shared policy, `~/.grok/rules` full copies). Pointers only for shared policy.
2. **Equal-rank vendors.** No adapter outranks another under the manager.
3. **Product I/O** goes through RevealUI MCP (governed user + receipts), not
   per-harness side channels for product actions.
4. **Session orientation** uses the shared tracker/manager check (one script),
   not dual banners re-authored per adapter.
5. **Quality over speed** still applies; thinning mirrors is not an excuse to
   skip proof.

## Illegal mirror (stop / thin)

A vendor rule file that restates a full Plane A hardline body instead of citing
the package definition or machine-global owner is an illegal mirror. Fix by
thinning to a pointer, not by copying more prose.

## References

- ADR harness policy / runtime / launch planes
- GAP-406, GAP-318, tracker-first, quality-over-speed
