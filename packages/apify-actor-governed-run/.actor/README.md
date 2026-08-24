# Governed Agent Run

If an agent did it, there's a receipt.

This actor runs an AI agent task for you and hands back both the result and a
cryptographically signed receipt of every action the agent took: every model
call and every tool call, in order, with a signature you can check offline
without ever talking to anyone.

## What you get

- **A completed task.** Give the actor a task and your own LLM API key
  (Anthropic, OpenAI, Groq, or xAI), and it runs an agent loop until the task
  is done or it hits a step limit.
- **A signed, tamper-evident receipt.** Every model call and tool call is
  recorded into an action log, and the whole log, together with the
  identifiers of the Apify run that produced it, is signed with a fresh
  Ed25519 key generated for that run. Anyone can check the signature offline
  with nothing but the receipt itself, and confirm that nothing in it changed
  after signing.
- **A platform-attributable run record.** The actor also publishes the receipt
  to that run's own dataset and key-value store on Apify, the same places the
  rest of the run's output lives. Only the actual running actor process can
  write there for that run, so a verifier who wants proof the run really
  happened, not just that the receipt is internally consistent, can fetch that
  record from the Apify API for the `actorRunId` embedded in the receipt and
  confirm it matches.
- **A way to check any receipt.** Run this actor again in "verify-receipt"
  mode with a receipt you already have, and it tells you whether the signature
  is valid. That run is billed at $0.00001, the lowest price Apify Console
  allows for an event ($0.00 is not an option).

**What a receipt proves, and what it doesn't.** Standalone verification (the
"verify-receipt" mode) proves the action log was not altered after signing. It
does not, by itself, prove the run happened on Apify at all. Anyone can
generate their own Ed25519 keypair and sign a fabricated action log claiming
any `actorRunId` they like, and that receipt will still verify. Proving
provenance, that a specific receipt corresponds to a run this actor actually
executed, needs the extra step above: checking `receipt.actorRunId` against
that run's own dataset or key-value record on Apify. This actor makes no SOC 2,
ISO, or other compliance claim either way.

## Input

| Field | Required | Description |
|---|---|---|
| `mode` | No (default `run-task`) | `run-task` or `verify-receipt` |
| `task` | Yes, for `run-task` | The task prompt for the agent |
| `llmProvider` | Yes, for `run-task` | `anthropic`, `openai`, `groq`, or `xai` |
| `llmApiKey` | Yes, for `run-task` | Your own API key (bring-your-own-key; never stored or logged) |
| `model` | No | Override the provider's default model |
| `toolAllowlist` | No | Restrict which built-in tools the agent may use; omit for all, `[]` for none |
| `maxSteps` | No (default 10) | Maximum model/tool-call round trips |
| `receipt` | Yes, for `verify-receipt` | A receipt object from a prior `run-task` run |

## Why bring your own API key

This actor charges per governed action and per completed run, not per model
token. Bringing your own LLM key means the price never has to cover model costs
on top of that, and you keep full control of and visibility into your own model
spend.

## Pricing

| Event | Price | Charged when |
|---|---|---|
| Governed action | $0.02 | Once per model call or tool call recorded into the action log |
| Governed run completed | $0.08 | Once when a governed run finishes and a signed receipt is produced |
| Receipt verification | $0.00001 | Once per "verify-receipt" run |

## How the receipt works

1. Every model call and tool call the agent makes is appended to an action
   log, in order, along with a final entry recording the run's output.
2. The action log, together with the run's `actorId`, `actorRunId`, and
   `actorBuildId`, is canonicalized with RFC 8785 JSON Canonicalization (so the
   byte representation is deterministic regardless of key order) and signed with
   a fresh Ed25519 keypair generated for that run.
3. The receipt embeds the action log, the run identifiers, the signature, the
   public key, the algorithm, and a timestamp. Because the receipt carries its
   own public key and names its algorithm, you can check the signature with any
   standard Ed25519 library, offline, depending on no external infrastructure
   and on this actor no longer needing to exist. Checking provenance, rather
   than only integrity, does depend on the run's own record still being
   retrievable from Apify.
4. The actor publishes that same receipt to the run's dataset and key-value
   store, both of which only the actual running actor process can write to for
   that run.

## Limitations (v0.1)

- The built-in tool catalog has exactly one tool (`web_fetch`, a bounded
  HTTP(S) fetch). It resolves DNS and blocks the private, loopback, link-local,
  and carrier-grade-NAT ranges across both IPv4 and IPv6 (including IPv4-mapped
  IPv6 addresses), and it does not follow redirects. It does not pin the
  connection to the address it validated, so a true DNS-rebinding attack, where
  the DNS answer changes between that check and the fetch a moment later, is out
  of scope. A public hostname with a static record pointed at a blocked address
  is fully blocked. Expanding the tool catalog is future work.

Built by RevealUI Studio.
