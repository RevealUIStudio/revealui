interface Capability {
  title: string;
  body: string;
  path: string;
  href: string;
}

const REPO_ROOT = 'https://github.com/RevealUIStudio/revealui/blob/main';
const REPO_TREE = 'https://github.com/RevealUIStudio/revealui/tree/main';

const capabilities: Capability[] = [
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
];

export function WhatsShipped() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Capabilities, file by file
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            What&apos;s actually shipped.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Nine load-bearing primitives most platforms ship as separate products &mdash; or never
            ship at all. Each card links to the actual file.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => (
            <a
              key={c.path}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-2xl bg-gray-50 p-6 ring-1 ring-gray-200 no-underline transition hover:bg-white hover:ring-gray-950/10 hover:shadow-sm"
            >
              <h3 className="text-base font-semibold text-gray-950 group-hover:text-emerald-800">
                {c.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">{c.body}</p>
              <code className="mt-4 inline-block self-start rounded bg-white px-2 py-1 font-mono text-[11px] text-emerald-800 ring-1 ring-emerald-200 group-hover:bg-emerald-50">
                {c.path}
              </code>
            </a>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-gray-500">
          Trust through specificity. Buyers comparing to Convex, Supabase, or Payload see depth
          competitors don&apos;t ship.
        </p>
      </div>
    </section>
  );
}
