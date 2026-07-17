---
"@revealui/harnesses": minor
---

add OpenCodeAdapter, the first external-CLI harness adapter: detects and drives the `opencode` CLI (headless run, config apply/sync/diff, running-instance discovery), promotes the `opencode` capability profile from roadmap to shipped, registers an OpenCode content generator (commands + agents), and adds `protocolConfigToOpencodeConfig` for wiring the governed RevealUI MCP endpoint into `opencode.json` via env-var token substitution (never a literal token).
