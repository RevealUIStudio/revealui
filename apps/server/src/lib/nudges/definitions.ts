/**
 * In-product nudge copy, per tier — GAP-300 §7 (Fable synthesis 2026-07-16).
 *
 * All 11 nudges named in the spec are represented here so the copy is a
 * single source of truth and the string-conformance test can pin every
 * one of them. Copy is VERBATIM from §7 — do not paraphrase headline,
 * body, or CTA text when editing this file.
 *
 * Live trigger evaluators: free-first-*, pro-first-action, pro-read-receipts,
 * max-local-inference, max-export-audit, ent-second-tenant.
 * Still deferred: free-pro-gate (needs security-reviewed requireFeature write),
 * pro-license-wire (self-hosted env), pro-connect-data (MCP map),
 * max-enable-memory (no toggle).
 */

export type NudgeId =
  | 'free-first-reply'
  | 'free-first-content'
  | 'free-pro-gate'
  | 'pro-first-action'
  | 'pro-license-wire'
  | 'pro-read-receipts'
  | 'pro-connect-data'
  | 'max-enable-memory'
  | 'max-local-inference'
  | 'max-export-audit'
  | 'ent-second-tenant';

/** Milestone priority order per the behavior contract: hour-1 beats hour-24 beats day-7. */
export type MilestoneRank = 'hour1' | 'hour24' | 'day7';

export interface NudgeDefinition {
  id: NudgeId;
  milestone: MilestoneRank;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export const NUDGE_DEFINITIONS: Record<NudgeId, NudgeDefinition> = {
  'free-first-reply': {
    id: 'free-first-reply',
    milestone: 'hour1',
    headline: 'Your admin is running.',
    body: 'Ask the agent to do something and watch it answer. That first reply is the whole point of this screen.',
    ctaLabel: 'Talk to your agent',
    ctaHref: '/chat',
  },
  'free-first-content': {
    id: 'free-first-content',
    milestone: 'hour24',
    headline: 'Put your agent to work on something real.',
    body: 'Create your first page and let the agent help you draft it.',
    ctaLabel: 'Create a page',
    ctaHref: '/pages',
  },
  'free-pro-gate': {
    id: 'free-pro-gate',
    milestone: 'day7',
    headline: 'You just found a Pro feature.',
    body: 'Pro agents act on your business and every action leaves a receipt you can check. Your free setup keeps working either way.',
    ctaLabel: 'See what Pro adds',
    ctaHref: '/upgrade',
  },
  'pro-first-action': {
    id: 'pro-first-action',
    milestone: 'hour1',
    headline: 'Your purchase is complete. Run your first agent task.',
    body: "Give an agent one real task and then open Task History. If an agent did it, there's a receipt.",
    ctaLabel: 'Run your first agent',
    ctaHref: '/agents',
  },
  'pro-license-wire': {
    id: 'pro-license-wire',
    milestone: 'hour24',
    headline: 'Your license key is ready on your account page.',
    body: 'Wire it into your runtime so every surface you paid for unlocks.',
    ctaLabel: 'Get your license key',
    ctaHref: '/account/license',
  },
  'pro-read-receipts': {
    id: 'pro-read-receipts',
    milestone: 'hour24',
    headline: 'Your agents have been busy.',
    body: 'Every action they took left a receipt. Read the trail once so you know what checking it feels like.',
    ctaLabel: 'Open the audit trail',
    ctaHref: '/audit',
  },
  'pro-connect-data': {
    id: 'pro-connect-data',
    milestone: 'day7',
    headline: 'Connect your agent to your real business data.',
    body: 'An agent that can read your content and your customers is the one that earns its keep.',
    ctaLabel: 'Connect a data source',
    ctaHref: '/mcp/connect',
  },
  'max-enable-memory': {
    id: 'max-enable-memory',
    milestone: 'hour1',
    headline: 'Memory is included in Max and it is switched off.',
    body: 'Turn it on and your agents keep what they learn between tasks.',
    ctaLabel: 'Enable memory',
    ctaHref: '/chat',
  },
  'max-local-inference': {
    id: 'max-local-inference',
    milestone: 'hour24',
    headline: 'Run models on hardware you control.',
    body: 'Set up local inference and choose exactly which models your agents use.',
    ctaLabel: 'Set up inference',
    ctaHref: '/settings/api-keys',
  },
  'max-export-audit': {
    id: 'max-export-audit',
    milestone: 'day7',
    headline: 'Your audit log exports.',
    body: 'Try it once so you know the receipts are yours to keep, not just to read.',
    ctaLabel: 'Export the audit log',
    ctaHref: '/audit',
  },
  'ent-second-tenant': {
    id: 'ent-second-tenant',
    milestone: 'day7',
    headline: 'Your first tenant is live.',
    body: 'Add your second site when you are ready, or bring it to your walkthrough call.',
    ctaLabel: 'Add a site',
    ctaHref: '/sites',
  },
};

/** Nudge ids with a live trigger evaluator wired in ./triggers.ts. */
export const IMPLEMENTED_NUDGE_IDS: readonly NudgeId[] = [
  'free-first-reply',
  'free-first-content',
  'pro-first-action',
  'pro-read-receipts',
  'max-local-inference',
  'max-export-audit',
  'ent-second-tenant',
];
