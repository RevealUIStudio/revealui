# RevealUI manager (Grok load path)

Grok loads this tree because cwd is the product. `$HOME/.grok` is a vendor
cache (auth, sessions, UI, hooks). Do not author policy there.

1. `.revealui/manager.json` then `.revealui/content/` (SSOT)
2. TRACKER from `tracker.path` on the manager
3. Product I/O via RevealUI MCP (`rfg`). Secrets via revvault
4. Keep `[compat.claude] rules = false`. Do not ingest the Claude vendor dump

Mechanical deny is PreToolUse (RevKit deploys hook JSON from this repo).
Git identity is `git config user.email` (RevKit identity.gitconfig), not this file.

Do not invent parallel queues under `$HOME/.grok`.
