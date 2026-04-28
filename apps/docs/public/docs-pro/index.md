# RevealUI Pro

RevealUI Pro adds AI agents, MCP integrations, and inference orchestration on top of the open-source foundation. The default and recommended inference path is open-model (Ollama, Canonical Inference Snaps); cloud-compatible providers (Groq, HuggingFace, OpenAI-compatible) are pluggable but opt-in.

## What's included

| Package | License | Description |
|---------|---------|-------------|
| [`@revealui/ai`](/pro/ai) | Fair Source (FSL-1.1-MIT, MIT after 2 years) | AI agents, open-model inference, CRDT memory, A2A protocol |
| [`@revealui/harnesses`](https://github.com/RevealUIStudio/revealui/tree/main/packages/harnesses) | Fair Source (FSL-1.1-MIT, MIT after 2 years) | Harness adapters, workboard coordination |
| [`@revealui/mcp`](/pro/mcp) | MIT (free for any tier) | MCP hypervisor, adapter framework, 14 first-party server launchers |
| [`@revealui/services`](https://github.com/RevealUIStudio/revealui/tree/main/packages/services) | MIT | Stripe + Supabase service integrations |
| [Open-Model Inference](/pro/inference) | — | Default Ollama; Inference Snaps planned; Groq / HuggingFace / OpenAI-compatible opt-in |
| [Editor Config Sync](/pro/editors) | — | Ships in the separate **RevCon** repo (not in this monorepo); not gated by Pro |

## License

The two Pro packages (`@revealui/ai`, `@revealui/harnesses`) are **Fair Source (FSL-1.1-MIT)** — source is visible in the public repo, the package is installable from npm, and each release converts to plain MIT after 2 years. Runtime feature gates verify your Pro / Forge / perpetual license via JWT (RS256).

`@revealui/mcp` and `@revealui/services` are MIT — free for any tier, including the Free plan.

- [View pricing](https://revealui.com/pricing)
- [Manage your license](https://admin.revealui.com)

## Installation

Install only the packages you need. `@revealui/mcp` is free; `@revealui/ai` requires a Pro license at runtime.

```bash
# OSS (free)
pnpm add @revealui/mcp

# Pro (Fair Source — installable from npm; runtime requires a license)
pnpm add @revealui/ai
```

Set your license key in the environment:

```bash
REVEALUI_LICENSE_KEY=your-license-key
```

## Quick links

- [AI agents guide](/pro/ai)
- [MCP server configuration](/pro/mcp)
- [Editor Config Sync — see RevCon](/pro/editors)
- [Open-model inference](/pro/inference)
- [Pro overview (canonical)](/docs/PRO)
