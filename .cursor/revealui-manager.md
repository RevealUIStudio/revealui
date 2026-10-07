> **RevealUI manager.** Policy and skills are owned by `.revealui/`.
> This vendor tree is an **adapter stub only** (equal rank with every other vendor).
> Do not fork hardlines here. Edit package definitions → generate into `.revealui/content/`.
> **Quality over speed:** correctness and proof outrank throughput in every session.

# RevealUI manager (Cursor adapter)

1. Open **`.revealui/manager.json`** for project authority.
2. Shared rules/skills: **`.revealui/content/`** (generated from `@revealui/harnesses`).
3. Day-to-day free surfaces: path in `manager.json` → `tracker.path` (fleet: `docs/TRACKER.md`).
4. Product I/O: RevealUI MCP only (device token via `rfg` / revvault) — not vendor side channels.
5. Equal vendors: Cursor is not more authoritative than Claude, Grok, or OpenCode.

`manager materialize` also emits `.cursor/hooks.json` (command hooks → `revealui-harnesses hook cursor`).
Do not fork hardline policy under `.cursor/rules/`; edit package definitions instead.

See `.revealui/README.md`.
