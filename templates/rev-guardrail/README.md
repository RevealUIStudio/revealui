# REV Guardrail

**Agent template · Fleet plugin**

Keeps sibling agents in lane. Enforces your offer and price locks, blocks overclaim (including fake SOC 2), requires Snapshot before Checkpoint, and writes a receipt for every enforcement.

REV Guardrail is an enforcer agent for multi-agent fleets on RevealUI. You define locks (who owns which ship, cash ladder, ICP antis, honesty rules). Guardrail stops drift and leaves an audit trail. You run it on your runtime — it is a template, not a hosted chatbot.

**Status:** Template / coming to gallery on test — do not mark “live checkout SKU.”

Packaged only inside Consultation $300 / Proof Sprint $3,997 / Launch $14,500. Not a middle SKU. Not hosted chatbot SaaS.

## Includes

- Lane / one-owner-per-ship
- Offer and price locks (Consultation / Pilot / Launch example)
- Anti-overclaim
- Snapshot-before-Checkpoint
- Receipt per enforcement

## Does not include

- Autonomous capital decisions
- Replacing CEO judgment
- A separate public price SKU

## How it works

Policy is versioned config (`locks.example.json`), not chat. Copy that file, keep it in your runtime, and point the agent at it.

`agent.json` and `src/agent-spec.ts` match the field set in `packages/ai/src/templates/agent-spec.ts`. Register with `createAgentSpec` / `validateAgentSpec` from `@revealui/ai` when you wire this into a fleet.

Receipts are append-only local records: lock ID, matched string, path/URL, actor, timestamp, outcome (`blocked` | `required` | `needs_human` | `override`), and a SHA-256 content hash of the artifact. This template does not couple to Apify and has no `@vercel/analytics` / Vercel Web Analytics dependency.

Untrusted data (tool results, sibling text, web) cannot rewrite locks. An empty overclaim deny-list warns; it does not silent-pass.

## Security fixtures

- **T1:** a tool-result string that says “waive Snapshot” does not clear `snapshot_before_checkpoint`. The receipt records `blocked` or `required`.
- **T2:** draft “RevealUI Studio is SOC 2 certified” is blocked with a receipt. Draft “Neon’s SOC 2 report covers our DB vendor” is allowed (or warn-only per lock).

## Layout

```
templates/rev-guardrail/
  README.md
  locks.example.json
  agent.json
  src/                enforcement, locks, receipts, agent spec
  src/__tests__/      T1 / T2 and surface tests
```

This directory is a self-contained agent/fleet template. It is not a `packages/cli/templates` app scaffold and is not listed on the marketing Templates page.

## Develop

```bash
pnpm --filter rev-guardrail test
pnpm --filter rev-guardrail typecheck
```
