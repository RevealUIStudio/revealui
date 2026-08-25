# Grok spawn types → control-layer agents

Grok TUI `spawn_subagent` types are the wire contract. Content agents in
`.revealui/content/agents/` (and this tree's `.grok/agents/`) are the policy
SSOT. Prefer one well-scoped subagent (token economy).

| Grok type | Content agent | When |
|-----------|---------------|------|
| `explore` | (builtin / home) | read-only codebase search (builtin) |
| `plan` | (builtin / home) | implementation plans (builtin) |
| `implementer` | `builder` | specced feature or bug work |
| `reviewer` | `security-reviewer` | PR / code / security review |
| `mechanic` | `linter` | renames, mechanical sweeps |
| `senior-architect` | (builtin / home) | design, ADRs, multi-system trade-offs |

When spawning `implementer`, `reviewer`, or `mechanic`, follow the matching
content agent prompt. Project agents (`builder`, `tester`, `linter`,
`security-reviewer`, `gate-runner`, `docs-sync`) are also valid spawn names
when Grok discovers them under `.grok/agents/`.

Do not invent a second taxonomy under `~/.grok/agents/`.
