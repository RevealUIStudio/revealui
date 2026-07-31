---
visibility: public
---

# RevealUI Pro

RevealUI Pro adds AI agents, MCP integrations, and inference orchestration on top of the open-source foundation. The default and recommended inference path is open-model (Ollama, Canonical Inference Snaps); cloud-compatible providers (Groq, HuggingFace, OpenAI-compatible) are pluggable but opt-in.

## What's included

| Package | License | Description |
|---------|---------|-------------|
| [`@revealui/ai`](/pro/ai) | Fair Source (FSL-1.1-MIT, MIT after 2 years) | AI agents, open-model inference, CRDT memory, A2A protocol |
| [`@revealui/harnesses`](https://github.com/RevealUIStudio/revealui/tree/main/packages/harnesses) | Fair Source (FSL-1.1-MIT, MIT after 2 years) | Harness adapters, workboard coordination |
| [`@revealui/mcp`](/pro/mcp) | Fair Source (FSL-1.1-MIT, MIT after 2 years) | MCP hypervisor, adapter framework, 13 first-party server launchers |
| [`@revealui/services`](https://github.com/RevealUIStudio/revealui/tree/main/packages/services) | Fair Source (FSL-1.1-MIT, MIT after 2 years) | Stripe, Solana (RVC), and Vercel integrations |
| [Open-Model Inference](/pro/inference) | — | Default Ollama; Inference Snaps planned; Groq / HuggingFace / OpenAI-compatible opt-in |
| [Editor Config Sync](/pro/editors) | — | Ships in the separate **RevCon** repo (not in this monorepo); not gated by Pro |

## License

Five RevealUI packages ship under **Fair Source (FSL-1.1-MIT)** — `@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, and `@revealui/services`. Source is visible in the public repo; the four published packages install from npm (`@revealui/engines` is a private workspace package), and each release converts to plain MIT after 2 years. The non-compete clause is the only restriction. Runtime feature gates on the hosted product verify your Pro / Enterprise / perpetual license via JWT (Ed25519).

- [View pricing](https://revealui.com/pricing)
- [Manage your license](https://admin.revealui.com)

## Installation

The Fair Source packages install from npm like any other. Source is visible and use is free — the non-compete clause is the only restriction. Some features check a license at runtime on the hosted product.

```bash
pnpm add @revealui/ai @revealui/mcp
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
