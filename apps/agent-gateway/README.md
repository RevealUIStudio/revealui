# Agent Gateway (RevealUI)

This lightweight service provides an OpenAI-compatible endpoint that routes requests into the RevealUI agent runtime.

Features
- OpenAI-compatible `/v1/chat/completions` endpoint
- Routes to model router which picks between Vultr / Docker / HuggingFace providers
- Minimal, dependency-free implementation (native `http` + ESM imports)

Prerequisites
- Node.js 18+ (native fetch and top-level await support helpful)
- (Optional) For Docker provider: run a HF TGI container on `:8080` (see `../docker-models`)
- (Optional) `VULTR_API_KEY`, `HF_TOKEN`, or `DOCKER_MODEL_URL` environment variables for providers

Run locally

1) Start the agent gateway server:

```bash
node apps/agent-gateway/server.ts
```

2) Make a test request (OpenAI-compatible):

```bash
curl -sS -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello from RevealUI demo"}]}' | jq
```

Notes
- The routing logic is in `apps/model-router/index.ts`.
- Providers are in `packages/inference-clients/` and can be configured via env vars.

If you want, I can add a docker-compose file to run the gateway + TGI container together.
