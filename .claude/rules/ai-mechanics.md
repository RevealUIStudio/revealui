# AI Mechanics (diagnosis)

Diagnose agent failures as **model / harness / context / smart zone / primary source**, not "the AI."

| Term | Means |
|------|--------|
| **Model** | Frozen weights; next-token prediction only |
| **Harness** | Tools, system prompt, permissions, hooks, context assembly |
| **Context** | Task-relevant knowledge the agent actually has (quality, not window size) |
| **Smart zone** | Early-session quality; later bloat is dumb zone  -  clear or hand off |
| **Primary source** | Code and tests; handoffs and docs are secondary |

## Progressive disclosure

- **Always-on:** this rule only.
- **Full glossary and AX checklist:** use approved project references discovered through the project manager.
- **Domain terminology:** use the project's configured glossary; keep private coordination locations out of exported instructions.

## Related

- **code-over-docs**  -  primary source wins on behavior claims
- **token-economy**  -  context and session cost
- **quality-over-speed**  -  do not skip proof to save tokens
