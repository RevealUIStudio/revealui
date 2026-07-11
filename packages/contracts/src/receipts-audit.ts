/**
 * @revealui/contracts/receipts-audit
 *
 * Single source of truth for the Agent Receipts Audit remediation guide:
 * twelve gap -> fix items, one per audit question. Consumed by:
 *   - apps/marketing/app/content/receipts-audit.ts (`RECEIPTS_AUDIT_REMEDIATION`
 *     on the /receipts-audit page — the page wraps this array with a
 *     heading + intro; the items themselves come from here).
 *   - apps/server/src/routes/waitlist.ts (the receipts-audit waitlist
 *     confirmation email embeds these items directly, so the "send you a
 *     copy" promise the page makes is actually true).
 * Eliminates the hand-duplicated copy that used to live separately in both
 * apps (precedent: `ARCHITECTURE_REVIEW_PRICE` in `./pricing.ts`).
 *
 * Each `fix` is grounded against the codebase or already-vetted marketing
 * copy (see PR history); unshipped capabilities are phrased as
 * capability-neutral guidance rather than a claim that RevealUI does this
 * today, per the marketing truth-source guardrails.
 *
 * @packageDocumentation
 */

export type RuntimePrimitive = 'People' | 'Content' | 'Offers' | 'Payments' | 'Agents';

export interface RemediationItem {
  /** Maps 1:1 to the audit question of the same id (1-12). */
  readonly id: number;
  readonly primitive: RuntimePrimitive;
  readonly title: string;
  readonly gap: string;
  readonly fix: string;
}

export const RECEIPTS_AUDIT_REMEDIATION_ITEMS: readonly RemediationItem[] = [
  {
    id: 1,
    primitive: 'Agents',
    title: 'List every action from last week',
    gap: 'You cannot reconstruct last week because agent actions were never written to one durable place.',
    fix: 'Every agent action signs into a tamper-evident, hash-chained audit log, so a full week of activity is one query away.',
  },
  {
    id: 2,
    primitive: 'People',
    title: 'Give every agent its own identity',
    gap: 'Agents that borrow a human login are invisible in your records and impossible to tell apart.',
    fix: 'Each agent becomes its own governed user, distinct from any human account, so every action traces back to the exact actor.',
  },
  {
    id: 3,
    primitive: 'People',
    title: 'Revoke one agent without collateral damage',
    gap: 'Shared credentials mean pulling one agent breaks the humans and agents sitting next to it.',
    fix: "Per-agent identity means revoking one agent's access does not touch anyone else's, human or agent.",
  },
  {
    id: 4,
    primitive: 'Content',
    title: 'See and undo what an agent changed',
    gap: 'A content change with no history is a change you can neither review nor undo.',
    fix: 'The fix starts with logging every content update against the agent that made it, so you know who touched what and when. Pair that with versioned backups so a bad edit is always recoverable, not just visible after the fact.',
  },
  {
    id: 5,
    primitive: 'Payments',
    title: 'Cap what an agent can spend',
    gap: 'An agent that can spend without a ceiling is an incident waiting to bill you.',
    fix: "The fix is a spend limit enforced before a transaction clears, not audited after. Give every agent a ceiling it has no way around, and treat 'no limit' as a finding, not a default.",
  },
  {
    id: 6,
    primitive: 'Agents',
    title: 'Know which provider saw your data',
    gap: 'If you cannot name the provider that saw your customer data, you cannot answer for where it went.',
    fix: 'You choose the AI provider per workload, and the same audit log that records every action records which model ran it, so tracing a request back to a provider is a lookup, not a guess.',
  },
  {
    id: 7,
    primitive: 'Agents',
    title: 'Prove who sent it',
    gap: 'Without a record of who acted, human versus agent is a guess.',
    fix: 'Every action signs into the audit log against the identity that produced it, human or agent, so the answer to a customer is in the record, not a promise.',
  },
  {
    id: 8,
    primitive: 'Content',
    title: 'Version your prompts and policies',
    gap: "Prompts and policies kept in someone's head cannot be reviewed or rolled back.",
    fix: 'Keep policies as code: reviewed, diffed, and versioned like everything else you ship. Give prompts the same discipline, written down and revertable, not tuned live in a chat window.',
  },
  {
    id: 9,
    primitive: 'Agents',
    title: 'Pause everything at once',
    gap: 'If pausing agents means chasing processes, you cannot stop an incident fast enough.',
    fix: 'The fix is a single control that pauses every agent at once. If reaching one today means chasing individual processes, that gap is worth closing before the next incident, not during it.',
  },
  {
    id: 10,
    primitive: 'Agents',
    title: 'Run agents on your own infrastructure',
    gap: "Agents on someone else's infrastructure put your data and your controls outside your reach.",
    fix: 'A self-hosted runtime keeps agents on infrastructure you control end to end, so the data and the controls never leave your boundary.',
  },
  {
    id: 11,
    primitive: 'Agents',
    title: 'Hear about a failure before your customer does',
    gap: 'A silent failure is one your customer reports before you do.',
    fix: 'The fix is routing a failure straight to a human, not just into a log someone might check later. Catching it before the customer does is the whole point of the alert.',
  },
  {
    id: 12,
    primitive: 'Agents',
    title: 'Produce the log in minutes',
    gap: 'An audit that takes days of log-digging is an audit you are not ready for.',
    fix: 'The same hash-chained audit log exports on demand, filtered by date or agent, so an auditor gets a clean record without you digging through days of raw logs.',
  },
] as const;
