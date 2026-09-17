# Omarchy

**Runtime template · Host plugin**

Runs great on Omarchy. Also Ubuntu, WSL, and macOS.

This is a dogfood / OSS wedge for Omarchy Quattro users who want the self-hosted RevealUI business runtime. It is a template, not a cash-ladder SKU, not a fourth public price SKU, and not required for Consultation, Pilot, or Launch. H1 stays startups.

**Status:** Template / coming to gallery on test. Do not mark a live checkout SKU. Do not promote off `test` until the owner asks.

Packaged only inside Consultation $300 / Pilot $1,500 / Launch $7,500. Not a middle SKU.

## Tested / supported

- Tested target: Omarchy Quattro
- Also supported: Ubuntu, WSL, macOS

No exclusivity claim. The same recipe works on those hosts.

## Install

### 1. Scaffold with create-revealui

```bash
npx create-revealui@latest
```

Open the project in Cursor. If you already use a local RevDev workspace, open the same directory there.

### 2. Docker (self-host)

From a RevealUI checkout:

```bash
cp .env.production.example .env
docker compose up -d
```

See the repo-root `docker-compose.yml`. Marketing is not part of compose. Bring your own Postgres (compose includes a local pgvector image) or point `POSTGRES_URL` at Neon.

### 3. Inference (do not reimplement snaps on Arch)

Point the runtime at an OpenAI-compatible or Ollama URL. Copy `runtime.example.json` and keep the URLs in your host env.

Ollama:

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

OpenAI-compatible (including an Ollama `/v1` endpoint):

```bash
LLM_PROVIDER=openai
OPENAI_BASE_URL=http://127.0.0.1:11434/v1
```

If Ubuntu Inference Snaps already run on another host (Ubuntu or WSL), point at that URL. Do not install or reimplement snaps on Arch.

```bash
LLM_PROVIDER=inference-snaps
INFERENCE_SNAPS_BASE_URL=http://<ubuntu-or-wsl-host>:9090/v1
```

`agent.json` and `src/agent-spec.ts` match the field set in `packages/ai/src/templates/agent-spec.ts`. Register with `createAgentSpec` / `validateAgentSpec` from `@revealui/ai` when you wire this into a fleet.

## Stream-safe tip (screen share)

When screen-sharing (OBS, YouTube, Cursor share), set `STREAM_SAFE=1` or use stream-safe shell mode. Inject secrets with `revvault run --env KEY=vault/path -- <cmd>` so values never appear in argv, TTY, or capture. Never expand `$(revvault get …)` into flags. Keep vault-private windows out of the capture.

## Does not include

- Omarchy as a required host
- Moving Ubuntu inference snaps onto Arch as SSOT
- A fourth public ladder SKU
- Railway as production

## Layout

```
templates/omarchy/
  README.md
  runtime.example.json
  agent.json
  src/                runtime config, agent spec
  src/__tests__/      surface, honesty, and runtime tests
```

This directory is a self-contained runtime/host template. It is not a `packages/cli/templates` app scaffold and is not a Vercel marketplace twin.

## Develop

```bash
pnpm --filter omarchy test
pnpm --filter omarchy typecheck
```
