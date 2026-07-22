> **RevealUI manager.** Policy and skills are owned by `.revealui/`.
> This vendor tree is an **adapter stub only** (equal rank with every other vendor).
> Do not fork hardlines here. Edit package definitions → generate into `.revealui/content/`.
> **Quality over speed:** correctness and proof outrank throughput in every session.

# RevealUI manager (Grok adapter)

Machine home (`~/.grok`) must stay **pointer-thin**. When cwd is this project:

1. Read `.revealui/manager.json`
2. Read `.revealui/content/` for shared rules
3. Open `tracker.path` from the manager (fleet TRACKER)
4. Product work via RevealUI MCP (`rfg`)

Do not copy hardlines into `~/.grok/rules/`.
