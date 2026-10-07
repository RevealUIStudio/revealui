> **RevealUI manager.** Policy and skills are owned by `.revealui/`.
> This vendor tree is an **adapter stub only** (equal rank with every other vendor).
> Do not fork hardlines here. Edit package definitions → generate into `.revealui/content/`.
> **Quality over speed:** correctness and proof outrank throughput in every session.

# RevealUI manager (Claude adapter)

1. Open **`.revealui/manager.json`** for project authority.
2. Shared policy SSOT: package definitions → **`.revealui/content/`** (materialize).
3. Claude loads `.claude/rules/`: definition-backed rule bodies are **mirrored** from content (GAP-421 phase 2); monorepo-only rules stay hand-authored here; this stub is adapter-only.
4. Day-to-day free surfaces: path in `manager.json` → `tracker.path` (fleet: `docs/TRACKER.md`).
5. Product I/O: RevealUI MCP only (device token via `rfg` / revvault) — not vendor side channels.
6. Equal vendors: Claude is not more authoritative than Grok, Cursor, or OpenCode.

See `.revealui/README.md`.
