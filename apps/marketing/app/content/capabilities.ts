// Sourced from: app/components/landing/WhatsShipped.tsx (Phase 1c, no copy changes).
// Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { SITE } from './site';

export interface Capability {
  readonly title: string;
  readonly body: string;
  readonly path: string;
  readonly href: string;
}

const REPO_ROOT = `${SITE.urls.repo}/blob/main`;
const REPO_TREE = `${SITE.urls.repo}/tree/main`;

export const CAPABILITIES_SECTION = {
  eyebrow: 'Capabilities, file by file',
  heading: "What's actually shipped.",
  body: 'Nine load-bearing primitives most platforms ship as separate products — or never ship at all. Each card links to the actual file.',
  footnote:
    "Trust through specificity. Buyers comparing to Convex, Supabase, or Payload see depth competitors don't ship.",
} as const;

export const CAPABILITIES: readonly Capability[] = [
  {
    title: 'Tamper-evident audit chain',
    body: 'Every mutation across every primitive — by humans or agents — signs into an HMAC-SHA256 hash chain. Tampering breaks the chain.',
    path: 'packages/db/src/schema/audit-log.ts',
    href: `${REPO_ROOT}/packages/db/src/schema/audit-log.ts`,
  },
  {
    title: 'Unified RBAC + ABAC policy engine',
    body: 'One policy plane covering humans, agents, and service accounts. Role checks, attribute checks, and action attribution all in one engine.',
    path: 'packages/security/src/authorization.ts',
    href: `${REPO_ROOT}/packages/security/src/authorization.ts`,
  },
  {
    title: 'Stripe webhook reconciliation',
    body: 'Most apps lose webhooks silently. This schema stores every event, retries failed handlers, and surfaces drift between Stripe and the local DB.',
    path: 'packages/db/src/schema/webhook-reconciliation.ts',
    href: `${REPO_ROOT}/packages/db/src/schema/webhook-reconciliation.ts`,
  },
  {
    title: 'CRDT operation replay',
    body: 'Most platforms snapshot-merge. RevealUI replays operations — collaborative editing across humans and agents stays correct after concurrent edits.',
    path: 'packages/db/src/schema/crdt-operations.ts',
    href: `${REPO_ROOT}/packages/db/src/schema/crdt-operations.ts`,
  },
  {
    title: 'Circuit breakers + retry + bulkhead',
    body: 'Production-grade resilience patterns wired into the runtime — adaptive timeouts, retry budgets, and bulkhead isolation that early-stage SaaS usually skips.',
    path: 'packages/resilience/src/circuit-breaker.ts',
    href: `${REPO_ROOT}/packages/resilience/src/circuit-breaker.ts`,
  },
  {
    title: 'Multi-agent harness',
    body: 'Claude, Cursor, and Copilot coordinate on the same project through a shared workboard — its own product category, ships in the runtime.',
    path: 'packages/harnesses',
    href: `${REPO_TREE}/packages/harnesses`,
  },
  {
    title: 'MCP hypervisor + introspection',
    body: 'One process supervises all MCP servers, surfaces their tool registries, and gates calls through the same RBAC + ABAC plane the rest of the runtime uses.',
    path: 'packages/mcp/src/hypervisor.ts',
    href: `${REPO_ROOT}/packages/mcp/src/hypervisor.ts`,
  },
  {
    title: 'Envelope encryption + key rotation',
    body: 'Sensitive fields wrapped in per-record DEKs encrypted by a KEK. Rotation is online — no downtime, no re-encrypt-the-world batch job.',
    path: 'packages/security/src/encryption.ts',
    href: `${REPO_ROOT}/packages/security/src/encryption.ts`,
  },
  {
    title: 'Code provenance tracking',
    body: 'Every commit attributed to human, agent, or model. A real supply-chain primitive baked into the data model — not bolted on after the fact.',
    path: 'packages/db/src/schema/code-provenance.ts',
    href: `${REPO_ROOT}/packages/db/src/schema/code-provenance.ts`,
  },
] as const;
