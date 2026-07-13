// Sourced from: app/components/landing/WhatsShipped.tsx (Phase 1c, no copy changes).
// Per the internal marketing-overhaul plan §4.4.

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
  body: 'Eight load-bearing primitives most platforms ship as separate products, or never ship at all. Each card links to the actual file.',
  footnote:
    'Trust through specificity. These are primitives most platforms ship as separate products, or never ship at all. Each card links to the actual file.',
} as const;

export const CAPABILITIES: readonly Capability[] = [
  {
    title: 'RBAC + ABAC policy engine',
    body: 'Role checks with inheritance and attribute policies with condition operators, proven by roughly 95 authorization tests in the security package alone.',
    path: 'packages/security/src/authorization.ts',
    href: `${REPO_ROOT}/packages/security/src/authorization.ts`,
  },
  {
    title: 'Stripe webhook reconciliation',
    body: 'Every event is recorded for idempotency, failed handlers are replayed from Stripe by a drain cron, and reconcile crons surface drift between Stripe and the local DB.',
    path: 'packages/db/src/schema/webhook-reconciliation.ts',
    href: `${REPO_ROOT}/packages/db/src/schema/webhook-reconciliation.ts`,
  },
  {
    title: 'CRDT operation replay',
    body: 'Most platforms snapshot-merge. RevealUI replays operations, so collaborative editing across humans and agents stays correct after concurrent edits.',
    path: 'packages/db/src/schema/crdt-operations.ts',
    href: `${REPO_ROOT}/packages/db/src/schema/crdt-operations.ts`,
  },
  {
    title: 'Circuit breakers + retry + bulkhead',
    body: 'Production resilience patterns wired into the runtime: circuit breakers with adaptive failure thresholds, configurable retry with backoff, and bulkhead isolation that early-stage SaaS usually skips.',
    path: 'packages/resilience/src/circuit-breaker.ts',
    href: `${REPO_ROOT}/packages/resilience/src/circuit-breaker.ts`,
  },
  {
    title: 'Agent harness + shared workboard',
    body: 'A working agent adapter, a shared workboard manager for cross-session coordination, and a translation layer. Adapter profiles for Claude Code and Cursor are specced on the roadmap, not shipped.',
    path: 'packages/harnesses',
    href: `${REPO_TREE}/packages/harnesses`,
  },
  {
    title: 'MCP hypervisor + introspection',
    body: 'One process supervises all MCP servers and surfaces their tool registries, so every adapter is discoverable from a single place.',
    path: 'packages/mcp/src/hypervisor.ts',
    href: `${REPO_ROOT}/packages/mcp/src/hypervisor.ts`,
  },
  {
    title: 'Envelope encryption + key rotation',
    body: 'Sensitive fields wrapped in per-record DEKs encrypted by a KEK, with a rotation manager that re-encrypts records under a new key.',
    path: 'packages/security/src/encryption.ts',
    href: `${REPO_ROOT}/packages/security/src/encryption.ts`,
  },
  {
    title: 'Agent edit attribution',
    body: 'Every collaborative edit records whether a human or an agent made it, and which model. A commit-level provenance schema and API ship alongside; the automatic commit ingest is on the roadmap.',
    path: 'apps/server/src/collab/provenance-logger.ts',
    href: `${REPO_ROOT}/apps/server/src/collab/provenance-logger.ts`,
  },
] as const;
