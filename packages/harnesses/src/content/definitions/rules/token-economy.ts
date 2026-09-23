import { autoCompactThresholdPercent, TOKEN_BUDGET } from '../../../token-budget.js';
import type { Rule } from '../../schemas/rule.js';

/**
 * Control-layer token-economy guardrails (GAP-362).
 * Claude adapter: ~/.claude/rules/token-economy.md (thin pointer when materialized).
 * Runtime primitives: revdev loop.* / events.wait / work.completed.
 *
 * Compact numbers are interpolated from `src/token-budget.ts`.
 */
const COMPACT_PCT = autoCompactThresholdPercent();
const SNAPSHOT_GATE = TOKEN_BUDGET.compactionAtTokens - TOKEN_BUDGET.snapshotHeadroomTokens;

export const tokenEconomyRule: Rule = {
  id: 'token-economy',
  tier: 'oss',
  name: 'Token Economy',
  description:
    'Spend tokens only where they buy value: auto-notify over poll, match loop cadence, stop when not advancing',
  scope: 'global',
  preambleTier: 1,
  tags: ['sdlc', 'hardline', 'cost', 'agents', 'harness'],
  content: `# Token Economy — Spend Tokens Only Where They Buy Value

**Status:** HARDLINE every session (all harnesses). Control-layer SSOT for GAP-362.
Owner directive 2026-07-16; control-layer re-read 2026-07-24 (not a dual-home twin).

Every token spent must buy proportional value. Tokens are a real cost for the
operator and for customers running agents. Thoroughness that prevents a wrong
merge is worth thousands of tokens. Waste is spend that changes nothing.

## Loops, wakeups, and polling

1. **Never poll for harness-tracked background work.** Background agents,
   \`run_in_background\` commands, and workflows re-invoke on completion.
   Scheduling a wakeup to "check on" them is pure waste. Prefer completion
   events (\`work.completed\`, \`events.wait\`, harness notifications).
2. **Never schedule wakeups only to keep a prompt cache warm.**
3. **Match loop cadence to the signal.** A job that takes ~8 minutes gets one
   ~480s check, not eight 60s polls. Idle heartbeats with no specific signal
   default to 1200–1800s. Sub-minute idle polling should warn (daemon
   \`loop.arm\` cadence guard) and prefer \`events.wait\`.
4. **Stop when not advancing.** Three consecutive no-op ticks means stop or
   widen — surface a signal (\`loop.not_advancing\`) and pause cleanly. Do not
   burn tokens on a dead loop.
5. **Surface and stop.** If an automation is spending tokens with no forward
   progress, end it and say so in one line.

## Tools, skills, subagents, workflows

- Invoke for a result you do not already have.
- One broad well-scoped delegation over many narrow round-trips.
- Do not re-run work a subagent already owns; wait for the result.
- Reserve large fan-out for proportional payoff.
- Batch independent tool calls; do not refetch cached external results.

## Context window

Parent sessions compact at ${TOKEN_BUDGET.compactionAtTokens} tokens on a ${TOKEN_BUDGET.contextWindowTokens} window (${COMPACT_PCT}%). Snapshot ${TOKEN_BUDGET.snapshotHeadroomTokens} tokens earlier (${SNAPSHOT_GATE}), before that compact runs.

The numbers are authored only in \`packages/harnesses/src/token-budget.ts\`. Grok materialize writes them to \`.revealui/adapters/grok/token-budget.json\`. RevKit applies \`compaction_at_tokens\` on ${TOKEN_BUDGET.models.map((id) => `\`${id}\``).join(' and ')} and \`auto_compact_threshold_percent = ${COMPACT_PCT}\`. Other harnesses follow this contract with their own compact mechanism. Do not copy those TOML keys into a pressure score that is not this window.

Grep and shell output past ${TOKEN_BUDGET.toolOutputCapChars} characters keeps ${TOKEN_BUDGET.toolOutputHeadChars} characters at the head and ${TOKEN_BUDGET.toolOutputTailChars} at the tail. File reads stay intact. The Grok hook is \`cap-tool-output.json\`, emitted next to the session hooks.

## Verification is proportional, not skipped

Right-sizing spend never means skipping verification on risky changes. Prove
tests red before claiming a fix. The economy is in not re-verifying what is
already proven — never in cutting the check that catches a real bug.

## Runtime primitives (RevDev)

| Primitive | Role |
|-----------|------|
| \`work.completed\` event | Emitted on \`tasks.complete\` (durable + in-process bus) |
| \`events.wait\` | Long-poll for completion instead of client busy-poll |
| \`loop.arm\` / \`tick\` / \`stop\` | Cadence warn + consecutive no-op stop signal |

Default path is unchanged when no loop is armed.

## Relationship

- **model-allocation** — right model; this rule is the *volume* sibling.
- **quality-over-speed** — never trade correctness for token savings.
- **durable-solutions** — no "poll until deploy" workarounds.
- **GAP-362** — living execution unit; this rule is the shared hardline text.
`,
};
