> **RevealUI manager.** Policy and skills are owned by `.revealui/`.
> This vendor tree is an **adapter stub only** (equal rank with every other vendor).
> Do not fork hardlines here. Edit package definitions → generate into `.revealui/content/`.
> **Quality over speed:** correctness and proof outrank throughput in every session.

# RevealUI manager (RevDev adapter)

RevDev Studio, Console, and the daemon are an **equal adapter**. They **read**
the project manager and generated content. They do not own a second rules tree.

When cwd is this project:

1. Read **`.revealui/manager.json`**
2. Read **`.revealui/content/`** for shared policy (SSOT after `manager materialize`)
3. Open `tracker.path` from the manager (fleet TRACKER)
4. Product I/O: RevealUI MCP (`rfg`) — not a vendor side channel
5. Local inference stays on snaps / Ollama via the daemon. No Anthropic SDK.

Do not create `~/.revdev/rules/` hardline copies. Do not emit a parallel
generator that duplicates `.revealui/content/`. Skills index RPC and
AgentRuntime cockpit loops are later GAP-293 phases.

See `.revealui/README.md` and `.jv/docs/gap-specs/GAP-293-revdev-harness-parity-design.md`.
