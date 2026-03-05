# RevealUI Pro

RevealUI Pro adds AI, MCP servers, and editor integrations on top of the open-source foundation.

## What's included

| Package | Description |
|---------|-------------|
| [`@revealui/ai`](/pro/ai) | AI agents, LLM providers, CRDT memory, A2A protocol |
| [`@revealui/mcp`](/pro/mcp) | MCP servers (Stripe, Supabase, Neon, Vercel, Playwright) |
| [`@revealui/editors`](/pro/editors) | Editor daemon (Zed, VS Code, Neovim adapters) |
| [`@revealui/services`](/pro/services) | Stripe + Supabase service integrations |
| BYOK | Bring Your Own Key — use your own LLM API keys |

## License

Pro packages are commercially licensed. An active Pro or Enterprise subscription is required.

- [View pricing](https://revealui.com/pricing)
- [Manage your license](https://cms.revealui.com)

## Installation

Pro packages are distributed via GitHub Packages. After purchasing, you'll receive a scoped token.

```bash
# .npmrc
@revealui:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${REVEALUI_NPM_TOKEN}
```

```bash
pnpm add @revealui/ai @revealui/mcp
```

## Quick links

- [AI agents guide](/pro/ai)
- [MCP server configuration](/pro/mcp)
- [Editor integrations](/pro/editors)
- [BYOK configuration](/pro/byok)
