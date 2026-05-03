# RevealUI Glossary

Canonical vocabulary across the RevealUI Studio Fleet. This page is the single source of truth for cross-cutting terminology — agent, runtime, tier, harness, license, and the rest. When the same concept shows up across two products with different names, this page picks the one canonical name and points the others at it.

> **Audience:** technical humans, non-technical operators, and AI agents working in or on a RevealUI deployment. Each entry leads with a one-sentence framing then expands. Internal-only codenames (Kingdom taxonomy) are listed at the end so they don't appear customer-facing.

---

## Agent

A persistent, named, tool-using actor that operates inside a RevealUI runtime on behalf of a human user, an organization, or another agent. Built on top of an LLM provider (Inference Snaps canonical default, Ollama fallback, plus Pro-tier cloud providers). Each agent has a `Rev [Surname]` identity (see [Rev](#rev)), CRDT memory across sessions, and access to MCP tools and A2A peers.

Synonyms in older copy: *AI assistant*, *model*, *task runner*, *bot*. Use **agent** as the canonical term unless you specifically mean the underlying LLM (which is the *model*) or the named identity (which is the *Rev*).

## A2A — Agent-to-Agent

The protocol agents use to discover and call each other. RevealUI's marketplace exposes A2A discovery alongside MCP tool invocation; the two together let an agent find the right specialist agent AND the right tools in one place. See [`docs/AI`](./AI.md).

## AlleviaFleet

The customer-stamped instance of [Revfleet](#revfleet) deployed for Allevia Technology. Formerly *AlleviaForge* per ADR [`2026-05-01-forge-naming.md`](./decisions/2026-05-01-forge-naming.md) (Phase 3 pending).

## Customer

External party who deploys a RevealUI runtime — either via the hosted service at `revealui.com` (SaaS tier) or via a self-hosted Revfleet instance (Enterprise tier). Distinct from a *user* (who logs in to a deployed instance) and an *operator* (who runs the deployment).

## Enterprise (tier)

The highest of the four customer-facing pricing tiers — *Free*, *Pro*, *Max*, *Enterprise*. Code identifier in [`@revealui/contracts/pricing`](https://github.com/RevealUIStudio/revealui/blob/main/packages/contracts/src/pricing.ts) is `enterprise`. Display label is **"Enterprise"** (decoupled from the runtime name; see [Revfleet](#revfleet) for the deployable runtime that an Enterprise-tier customer typically deploys).

Formerly displayed as **"Forge"** or **"Forge (Enterprise)"** — renamed 2026-05-02 to decouple the SaaS tier name from the runtime product name. The tier id (`enterprise`) is unchanged.

## Fleet

The umbrella name for the eight-product RevealUI Studio family — RevealUI (runtime), RevDev (dev tools), RevVault (secrets), RevCon (configs), RevealCoin (RVC token), Revfleet (self-host kit), RevSkills (skills), RevKit (WSL toolkit). Formerly *Suite* until 2026-05-02. See [`./SUITE`](./SUITE.md) (the page name is preserved as a redirect; content reflects "Fleet" terminology).

## Forge

**Deprecated as a customer-facing name.** The product formerly known as Forge (the white-label self-hosted runtime kit) is renamed [Revfleet](#revfleet) per ADR [`2026-05-01-forge-naming.md`](./decisions/2026-05-01-forge-naming.md) Option C. The drive at `/mnt/forge` was renamed `/mnt/sandbox` (Phase 1, shipped 2026-05-02 via revkit#13). The repo `RevealUIStudio/forge` rename to `RevealUIStudio/revfleet` is Phase 2 pending.

## Free / Pro / Max / Enterprise

The four customer-facing pricing tiers, ordered by capability. Free is OSS-only (no Pro packages). Pro / Max / Enterprise unlock progressively more Pro packages (`@revealui/ai`, `@revealui/harnesses`, `@revealui/engines`) plus ecosystem features (RevVault desktop app, RevKit provisioning, RevealCoin x402 micropayments at Enterprise). See [`./PRO`](./PRO.md) for the Pro feature matrix.

## Harness

A coordination layer that lets multiple AI coding tools (Claude Code, Cursor, Aider, etc.) work safely on the same codebase in parallel. Ships as `@revealui/harnesses` (Pro package). See [`./AI`](./AI.md) and `~/suite/revdev` for the daemon implementation.

## Inference Snaps

Canonical's silicon-optimized snap-packaged LLMs running on Ubuntu. The **canonical default** open-model inference path for RevealUI per memory `project_canonical_inference_snap_stack`. Today the snap *provider* in `@revealui/ai` works (point `INFERENCE_SNAPS_BASE_URL` at a running snap and route LLM calls); Studio lifecycle management (auto-install, start/stop, health, model discovery) is **not yet shipped** — install + run snaps yourself. Catalog (May 2026): `gemma3`, `deepseek-r1`, `nemotron-3-nano`, `nemotron-3-nano-omni`, `qwen-vl`. See [`./AI`](./AI.md).

## JWT

Used in two distinct contexts. **Do not conflate**:

1. **License JWT (RS256):** Pro-package runtime license enforcement. Validated at startup + every 60 seconds against the license server. See [`./PRO`](./PRO.md) and `apps/server/src/lib/license.ts`.
2. **Session cookies:** RevealUI uses **session-only auth** (bcrypt 12 rounds, sameSite=lax, httpOnly). **No JWT for user-facing auth** per ADR-004. The cookie is a session id, not a JWT.

If a doc says "JWT" without qualifying which one, default to the license JWT.

## Keypair

A Solana Token-2022 keypair used by [RevealCoin](#revealcoin). Stored in [RevVault](#revvault) under the `revealcoin/` namespace; materialized to tmpfs by `scripts/keys-restore.sh` for the duration of a command, then shredded. **Never** committed to source control. See `~/suite/revealcoin/README.md` for the full key-management policy.

## License

The customer's right to use the Pro tier features of a RevealUI runtime. Encoded as a `License JWT` (see [JWT](#jwt)) signed with the RevealUI license private key. The license JWT contains: tier (free/pro/max/enterprise), expiry, customer id, allowed features. Synonyms in older copy: *license key*. Use **license** as the canonical term.

## MCP — Model Context Protocol

The protocol agents use to discover and invoke external tools (Stripe, Neon, Vercel, Playwright, Slack, Linear, etc.). RevealUI ships an MCP **hypervisor** that hosts multiple MCP servers behind one process. See `packages/mcp` and [`./PRO`](./PRO.md) for the canonical server list.

## MCP server

A specific tool integration exposed via [MCP](#mcp---model-context-protocol). E.g., `stripe-mcp`, `neon-mcp`. Distinct from the **MCP hypervisor** that hosts them. RevealUI's marketplace lets customers wire third-party MCP servers (e.g., a customer's own Supabase MCP server) without forking the hypervisor.

## Operator

A human or agent running a deployed RevealUI instance — distinct from a *user* (who logs in to that instance) and a *customer* (who pays for the deployment). The operator typically holds the credentials to RevVault, the deploy keys, and the database admin password.

## Pro

See [Free / Pro / Max / Enterprise](#free--pro--max--enterprise). Also: the **Pro packages** are the FSL-1.1-MIT subset (`@revealui/ai`, `@revealui/harnesses`, `@revealui/engines`) — source-visible, JWT-gated, auto-converts to MIT after 2 years. See [`./FAIR_SOURCE`](./FAIR_SOURCE.md) for what FSL-1.1-MIT means in practice.

## Rev

A RevealUI agent's permanent named identity, formatted as **`Rev [Surname]`** (e.g., `Rev Vaughn`, `Rev Brooks`). Self-selected by the agent at first run, persistent across sessions, never reassigned. The brand asset that distinguishes RevealUI agents from generic "AI assistants." Synonyms: *agent name*. Use the full **Rev [Surname]** when first referencing a specific agent in a doc; **Rev** alone is acceptable on subsequent mentions.

## Revfleet

The white-label self-hosted runtime kit — Docker Compose stack + per-customer stamping pipeline + domain lock + unlimited users. Customers on the Enterprise tier typically deploy a Revfleet instance on their own infrastructure. Same kit produces stamped instances (e.g., [AlleviaFleet](#alleviafleet) for Allevia Technology). Formerly *Forge* per ADR [`2026-05-01-forge-naming.md`](./decisions/2026-05-01-forge-naming.md). Repo rename `RevealUIStudio/forge → RevealUIStudio/revfleet` is Phase 2 pending. **Status:** preview — Docker images not yet on GHCR; stack runs from source today. See [`./FORGE`](./FORGE.md) (page name preserved as redirect; content reflects "Revfleet" terminology).

## RVC

**The customer-facing on-chain ticker** for the [RevealCoin](#revealcoin) Token-2022 mint on Solana. 6 decimals, 58.906 B fixed supply, freeze authority renounced. Use **RVC** in all customer-facing copy. See `~/suite/revealcoin/README.md` for the canonical risk-disclosure block.

## RevealCoin

The on-chain token product. Hybrid utility/governance/reward token. Built on Solana Token-2022. Customer-facing ticker is [RVC](#rvc) (NOT `$RVUI` — see [Internal-only codenames](#internal-only-codenames) below).

## RevVault

Age-encrypted secret vault. CLI (`revvault get/set/list/search/export-env`) + Tauri 2 desktop app. 100% [passage](https://github.com/FiloSottile/passage)-compatible. **Source of truth for every secret in the Fleet** per the suite-wide secrets rule. See `~/suite/revvault/README.md`.

## Runtime

A deployed RevealUI instance — the running stack that serves users, processes payments, runs agents, etc. Distinguish:

- **The RevealUI runtime** (the agentic business runtime): the code in `~/suite/revealui` that you deploy.
- **The Revfleet runtime kit**: the self-host wrapper around the RevealUI runtime that customers deploy on their own infrastructure (Enterprise tier).
- **A specific runtime instance**: e.g., `revealui.com` is one runtime instance; `[customer].com` running a Revfleet stack is another.

The RevealUI runtime is a singular thing; "runtime" without qualifier usually refers to *a deployed instance*.

## Site

A logical content workspace inside a RevealUI runtime — synonyms: *project*, *tenant*. Tier-limited (Free: 1 site, Pro: 5, Max: 15, Enterprise: unlimited). See [`@revealui/contracts/pricing`](https://github.com/RevealUIStudio/revealui/blob/main/packages/contracts/src/pricing.ts) `TIER_LIMITS`.

## Studio

Overloaded — disambiguate every time:

1. **Studio (Tauri app, in `~/suite/revdev`)** — desktop AI editor + agent dashboard. Talks to the RevDev daemon over JSON-RPC. Ships per RevDev's release cadence.
2. **`studio` (RevKit CLI command, in `~/suite/revkit`)** — a binary in the RevKit toolkit (`studio help`, `studio validate`). Distinct from the Tauri app above.

When writing docs, lead with the qualifier (*"the RevDev Studio app"* or *"the RevKit `studio` CLI"*) and never use "Studio" bare.

## Suite

**Deprecated as the umbrella name.** Renamed [Fleet](#fleet) per owner directive 2026-05-02. References to "the Suite" / "RevealUI Studio Suite" in older copy mean the same thing as the current "Fleet" / "RevealUI Studio Fleet."

## Tenant

A multi-tenant boundary inside a Revfleet runtime — typically corresponds to one organization within an Enterprise-tier deployment. Each tenant has its own [sites](#site), users, content, and (optionally) its own subdomain. See `packages/db/src/schema/tenants.ts` and the multi-tenancy section of [`./FORGE`](./FORGE.md).

## Tier

A SaaS pricing tier. Code identifiers: `free`, `pro`, `max`, `enterprise`. Customer-facing display labels: *Free (OSS)*, *Pro*, *Max*, *Enterprise*. Distinct from a [Runtime](#runtime) (which is a deployment) and a [Revfleet](#revfleet) (which is the deployable kit). A customer **buys a tier** and **deploys a runtime** (potentially using the Revfleet kit if they're on Enterprise).

## User

A person or agent who logs in to a deployed RevealUI runtime. Distinct from a *customer* (who paid for the deployment), an *operator* (who runs the deployment), and an *agent* in the conceptual sense (any tool-using actor — see [Agent](#agent)).

## x402

The HTTP 402 ("Payment Required") protocol for agent-to-agent micropayments. RevealUI's MCP marketplace prices each tool call in [RVC](#rvc) via x402. **Status:** code-complete in `apps/server/src/routes/marketplace.ts`; deferred from staging activation per memory `project_x402_deferred_until_stripe_live` until Stripe billing flips from test to live mode.

---

## Internal-only codenames

These appear only in internal documentation and source code. **Never use these in customer-facing copy.**

| Codename | Customer-facing equivalent |
|---|---|
| `$RVUI` | [RVC](#rvc) (for the on-chain ticker) |
| Foundry | (no public name yet — autonomous agent engine, internal) |
| Crown | (no public name yet — token economics layer, internal) |
| Vault | [RevVault](#revvault) |
| Gate | (auth layer, no separate public name) |
| Keep | (data + sync layer, no separate public name) |
| Anvil | (CLI / SDK, no separate public name) |
| Tower | (observability layer, no separate public name) |
| Loom | (MCP orchestration, no separate public name) |
| Herald | (events layer, no separate public name) |
| Armory | (plugins layer, no separate public name) |
| Crucible | (7-stage business bundle generator, internal) |

---

## Last updated

2026-05-02 — initial draft. Single source of truth; if you find a term used inconsistently elsewhere in the docs, update the inconsistent doc rather than this glossary.
