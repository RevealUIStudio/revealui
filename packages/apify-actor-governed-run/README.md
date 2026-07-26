# Governed Agent Run

If an agent did it, there's a receipt.

This actor runs an AI agent task for you and hands back both the result and a
cryptographically signed, offline-verifiable receipt of every action the
agent took: every model call and every tool call, in order, with a signature
you can check without ever talking to us again.

## What you get

- **A completed task.** Give the actor a task and your own LLM API key
  (Anthropic or OpenAI), and it runs an agent loop until the task is done or
  it hits a step limit.
- **A signed receipt.** Every model call and tool call is recorded into an
  action log, and the whole log is signed with a fresh Ed25519 key generated
  for that run. The public key travels with the receipt, so anyone can verify
  it offline with nothing but the receipt itself.
- **A free way to check any receipt.** Run this actor again in
  "verify-receipt" mode with a receipt you already have, and it tells you
  whether the signature is valid. This mode is free.

What the receipt is: a cryptographically signed and offline-verifiable record
of the actions an agent took. What it is not: a compliance certification of
any kind. This actor makes no SOC 2, ISO, or other compliance claim.

## Input

| Field | Required | Description |
|---|---|---|
| `mode` | No (default `run-task`) | `run-task` or `verify-receipt` |
| `task` | Yes, for `run-task` | The task prompt for the agent |
| `llmProvider` | Yes, for `run-task` | `anthropic` or `openai` |
| `llmApiKey` | Yes, for `run-task` | Your own API key (bring-your-own-key; never stored or logged) |
| `model` | No | Override the provider's default model |
| `toolAllowlist` | No | Restrict which built-in tools the agent may use; omit for all, `[]` for none |
| `maxSteps` | No (default 10) | Maximum model/tool-call round trips |
| `receipt` | Yes, for `verify-receipt` | A receipt object from a prior `run-task` run |

## Why bring your own API key

This actor charges per governed action and per completed run, not per model
token. Bringing your own LLM key means our price never has to cover model
costs on top of that, and you keep full control of and visibility into your
own model spend.

## Pricing (pay per event)

See https://docs.apify.com/platform/actors/development/actor-definition/actor-json
(verified July 2026): there is no `pricingInfos` field in `.actor/actor.json`.
Apify's pay-per-event prices are set through the Apify Console or through a
`PUT /v2/acts/{actorId}` API call instead, not through a file in this repo.
[`src/pricing.config.ts`](./src/pricing.config.ts) is this repo's single
source of truth for the event catalog; whoever applies pricing in
Console/API must register the same event names with these prices.

**Launch prices, owner-ruled 2026-07-26** (value-anchored; will be recorded in
`business/offerings-canonical.md` in the internal coordination repo once this
actor is adopted/published):

| Event | Price | Charged when |
|---|---|---|
| `governed-action` | $0.02 | Once per model call or tool call recorded into the action log |
| `run-completed` | $0.08 | Once when a governed run finishes and a signed receipt is produced |
| `receipt-verification` | $0.00 (free) | Once per `verify-receipt` invocation |

To change a price, edit `src/pricing.config.ts` and re-apply it to Apify --
the code that calls `Actor.charge({ eventName })` never has to change for a
price-only adjustment. Example `PUT` body shape (see
[Update Actor | API](https://docs.apify.com/api/v2/act-put)):

```json
{
  "pricingInfos": [
    {
      "pricingModel": "PAY_PER_EVENT",
      "pricingPerEvent": {
        "actorChargeEvents": {
          "governed-action": { "eventTitle": "Governed action", "eventPriceUsd": 0.02 },
          "run-completed": { "eventTitle": "Governed run completed", "eventPriceUsd": 0.08 },
          "receipt-verification": { "eventTitle": "Receipt verification", "eventPriceUsd": 0.0 }
        }
      }
    }
  ]
}
```

## How the receipt works

1. Every model call and tool call the agent makes is appended to an action
   log, in order, along with a final entry recording the run's output.
2. The action log is canonicalized with RFC 8785 JSON Canonicalization (the
   same canonicalizer RevealUI's own internal audit log uses, so the byte
   representation is deterministic regardless of key order) and signed with a
   fresh Ed25519 keypair generated for that run.
3. The receipt embeds the action log, the signature, the public key, the
   algorithm, and a timestamp. Nothing about verifying it depends on
   RevealUI's infrastructure or on this actor still existing.

```ts
import { verifyReceipt } from '@revealui/apify-actor-governed-run';

const result = verifyReceipt(receipt); // { valid: boolean, reason?: string }
```

## Known limitations (v0.1)

- The built-in tool catalog has exactly one tool (`web_fetch`, a bounded
  HTTP(S) fetch). It refuses obvious private/loopback/cloud-metadata hosts
  and does not follow redirects, but it is not a complete SSRF defense (no
  DNS-rebinding protection). Expanding the tool catalog is future work.
- The Dockerfile has not been smoke-tested against a live `apify run` or the
  Apify build system. Run `apify run` locally and `apify push` to a test
  actor before Store submission.
- This PR is review-pending under the fleet's guardrail-2 security review
  gate (the receipt-signing code touches a security-sensitive surface). See
  the PR body.

## Development

```bash
pnpm --filter @revealui/apify-actor-governed-run typecheck
pnpm --filter @revealui/apify-actor-governed-run test
pnpm turbo run build --filter=@revealui/apify-actor-governed-run...
```

## License

Internal, unpublished. Ships to the Apify Store as a Docker image, not to npm.
