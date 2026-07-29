# `.revealui` — project manager (all vendors equal)

This directory is the **RevealUI project manager**. Claude, Grok, Cursor, OpenCode, VS Code, and the native RevealUI agent all have **the same rank**: they are adapters that **reference** this tree. None of them is a second policy home.

## Quality over speed (standing order)

**Quality is always the primary metric** for code, config, and documentation.
Concurrent sessions, cheaper inference, and faster hardware may arrive later;
rushed dual-home shortcuts and unproven docs do not get a pass. Prefer a smaller
correct slice over a larger weak one. Full bar: content rule \`quality-over-speed\`
(from \`@revealui/harnesses\`).

## Authority

| Layer | Role |
|-------|------|
| `@revealui/harnesses` package definitions | Build-time SSOT for rules/skills/commands/agents |
| **`.revealui/` (this tree)** | On-disk manager for the project |
| `.claude` / `.cursor` / `.opencode` / `~/.grok` | Thin adapter stubs or machine prefs only |

## Layout

```text
.revealui/
  manager.json          # adapters[], contentRoot, tracker path, mcp config path
  content/              # generated rules, commands, agents, skills
  adapters/             # optional vendor notes (e.g. grok.md)
  code-standards.json   # code validator standards
  skills/               # committed skill pack (may merge with content/ over time)
  templates/            # package.json script templates
  vscode-plugin/        # VS Code agent plugin (already under manager)
  README.md             # this file
```

## Commands

```bash
# Write manager.json + generate content/ + equal-rank adapter stubs
pnpm exec revealui-harnesses manager materialize

# Verify manager present
pnpm exec revealui-harnesses manager check

# Generate content only (into .revealui/content)
pnpm exec revealui-harnesses content sync --generator claude-code
```

## What adapters must do

1. Open **`manager.json`** when entering the project.
2. Treat **`content/`** as the generated, committed shared-policy tree (from `@revealui/harnesses`). Until control-layer phase 2, Claude Code and peers still load their vendor trees (for example `.claude/rules/`); those bodies should match definitions via materialize + freshness CI, not by hand-forking.
3. Use **tracker.path** for day-to-day free surfaces (fleet: `docs/TRACKER.md`).
4. Product I/O via **RevealUI MCP** (token from revvault / `rfg`) — not vendor side channels.
5. **Do not** full-copy hardlines into `~/.claude` or `~/.grok`.

## Machine vs project

| Root | Role |
|------|------|
| `./.revealui` | **This** manager (project) |
| `~/.revealui` | Operator secrets (revvault) + harness config backup — not product policy |

## Related

- GAP-406 (adapter-only + manager)  
- ADR `2026-07-21-harness-policy-runtime-launch-planes`  
- ADR `2026-07-22-single-fleet-tracker`
