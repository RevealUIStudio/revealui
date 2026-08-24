# Owner publish checklist — Governed Agent Run (GAP-431)

Agent implementation for the actor package is **done** (governed run + signed
receipt + verify-receipt mode + PPE charge hooks + Store listing in
`packages/apify-actor-governed-run/.actor/README.md`). Closure is **owner publish** only.

Prices (locked in `packages/apify-actor-governed-run/src/pricing.config.ts` and `.jv` Track E):

| Event | Name | USD |
|-------|------|-----|
| Governed action | `governed-action` | $0.02 |
| Completed run | `run-completed` | $0.08 |
| Receipt verification | `receipt-verification` | $0.00001 (Console minimum; $0.00 is not an option) |

Apify does **not** read prices from the repo. Console/API must match those
event names or charges silently become $0.

## 1. Account + actor

1. Create or sign in to the RevealUI Apify organization account.
2. Configure payout (bank / PayPal) under Account → Billing.
3. Local tools (optional):

```bash
npm i -g apify-cli
apify login
```

## 2. Build standalone image payload

From monorepo root (`origin/test` or later):

```bash
pnpm --filter @revealui/apify-actor-governed-run test
pnpm --filter @revealui/apify-actor-governed-run build
# If a standalone docker context script exists:
pnpm build:apify   # when present at root; else follow package README Docker section
```

Smoke locally before Store:

```bash
cd packages/apify-actor-governed-run
# apify run  # with INPUT for verify-receipt using a fixture receipt
```

## 3. Push actor

```bash
cd packages/apify-actor-governed-run
apify push
# or Console: create actor → connect GitHub monorepo path / upload Docker build
```

Record the actor id (`username~governed-agent-run` or similar) on GAP-431 when live.

## 4. Pay-per-event pricing (Console or API)

**Console:** Actor → Monetization → Pay per event → register exactly:

- `governed-action` → $0.02  
- `run-completed` → $0.08  
- `receipt-verification` → $0.00001  

**API** (shape from package README; auth = Apify token):

```bash
# PUT /v2/acts/{actorId} with pricingInfos PAY_PER_EVENT actorChargeEvents
# names must match pricing.config.ts CHARGEABLE_EVENTS.*.name
```

## 5. Store listing

- Public copy is **`packages/apify-actor-governed-run/.actor/README.md` only** (not the package root README).
- Keep Store Terms §4.2: no off-platform spam / competitor bait in listing.
- Categories: AI, Agents, Developer tools (pick best fit in Console).

## 6. Acceptance smoke (close GAP-431)

1. Paid `run-task` with BYOK Anthropic or OpenAI key → receipt returned.  
2. Dataset / KV `OUTPUT` contains the same receipt.  
3. Second run `verify-receipt` → valid, **$0** charge.  
4. Billing shows `governed-action` × N + one `run-completed`.  
5. Paste Store URL + one run id into GAP-431 progress; set status closed.

## 7. Free discovery surfaces (after Store is live)

GAP-431 work item 4: same capability on free directories once the actor is public.
Do **not** submit these before the Store listing and PPE pricing are live, or the
links will 404 or under-claim.

| Surface | When | Owner action |
|---------|------|----------------|
| **Apify Store** | Required for close | §5 + public actor URL |
| **Claude Connectors / MCP directory** | After Store live | If/when Anthropic accepts remote MCP or actor-as-tool listings: submit the Store URL + short description that matches `.actor/README.md` foil ("If an agent did it, there's a receipt"). No parallel marketing copy. |
| **ChatGPT Apps / custom GPT tools** | After Store live | Same: link the live actor or a thin MCP wrapper only if product already exposes one; do not invent a second MCP server for discovery. |
| **Make / n8n / Gumloop** | Optional, Apify auto-dist | Confirm Apify distribution toggles; no extra implementation. |

Record submission ids / URLs under GAP-431 progress when done. Free directories are
**not** a substitute for the paid smoke in §6.

## Do not

- Re-scaffold the package or fork MCP primitives.  
- Change prices without updating Track E + `pricing.config.ts` together.  
- Publish the internal developer README as the Store listing.
- Submit Claude/ChatGPT listings before the Apify Store URL exists.
