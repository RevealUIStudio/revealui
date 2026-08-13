import { StatusDot, VerdictChip } from '@revealui/presentation';

/**
 * Live product-chrome frame for the homepage Demo section.
 *
 * Honest product-as-proof: real `@revealui/presentation` primitives
 * (StatusDot, VerdictChip), not a screenshot. Admin shell shape only.
 *
 * GAP-480 de-dupe: does NOT re-stage the hero refund receipt / AuditLine
 * trail. Hero owns the receipt motif; this frame shows agents as governed
 * users (roster + policy verdicts) so the page tells two complementary
 * product stories once each.
 *
 * Linear craft: hierarchy + density over decorative chrome.
 */

const SIDEBAR_NAV = [
  { label: 'People', active: false },
  { label: 'Content', active: false },
  { label: 'Offers', active: false },
  { label: 'Payments', active: false },
  { label: 'Agents', active: true },
] as const;

interface AgentRow {
  readonly name: string;
  readonly role: string;
  readonly status: 'ok' | 'warn' | 'idle';
  readonly statusLabel: string;
  readonly verdict: 'approve' | 'request-changes' | 'hold' | 'pending';
  readonly asOf: string;
}

const AGENT_ROWS: readonly AgentRow[] = [
  {
    name: 'support-agent',
    role: 'Customer refunds · $100 cap',
    status: 'ok',
    statusLabel: 'Online',
    verdict: 'approve',
    asOf: '09:41',
  },
  {
    name: 'billing-agent',
    role: 'Subscription changes',
    status: 'ok',
    statusLabel: 'Online',
    verdict: 'hold',
    asOf: '09:38',
  },
  {
    name: 'ops-agent',
    role: 'Deploy gates',
    status: 'idle',
    statusLabel: 'Idle',
    verdict: 'request-changes',
    asOf: '09:12',
  },
] as const;

export interface ProductFrameProps {
  /** Accessible name for the frame landmark. */
  readonly label?: string;
  /** Caption under the frame (mockup honesty line). */
  readonly caption?: {
    readonly prefix: string;
    readonly code: string;
    readonly suffix: string;
  };
}

export function ProductFrame({
  label = 'RevealUI admin shell, live component demo',
  caption,
}: ProductFrameProps) {
  return (
    <figure className="mx-auto w-full max-w-5xl" aria-label={label}>
      {/* Product mat: elevation over brand decoration.
          No nested interactive controls (axe WCAG 4.1.2). */}
      <div className="overflow-hidden rounded-2xl bg-foreground p-1 shadow-lg shadow-foreground/10 sm:p-1.5">
        <div className="overflow-hidden rounded-xl bg-background">
          <div className="flex h-9 items-center gap-3 border-b border-border px-3 sm:h-10 sm:px-4">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              <span className="size-2 rounded-full bg-muted-foreground/25" />
            </div>
            <div className="flex flex-1 items-center justify-center">
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                admin.local · Agents
              </span>
            </div>
            <div className="w-8" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[10.5rem_1fr]">
            <aside
              className="hidden border-r border-border bg-secondary/30 p-2 sm:block"
              aria-hidden="true"
            >
              <div className="mb-3 flex h-8 items-center gap-2 px-2">
                <span className="flex size-5 items-center justify-center rounded-[5px] bg-primary font-display text-[9px] font-bold text-primary-foreground">
                  R
                </span>
                <span className="text-xs font-medium text-foreground">RevealUI</span>
              </div>
              <ul className="space-y-0.5">
                {SIDEBAR_NAV.map((item) => (
                  <li key={item.label}>
                    <span
                      className={
                        item.active
                          ? 'flex h-8 items-center gap-2 rounded-md bg-muted px-2 text-xs font-medium text-foreground'
                          : 'flex h-8 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground'
                      }
                    >
                      <span
                        className={
                          item.active
                            ? 'size-1 rounded-full bg-foreground'
                            : 'size-1 rounded-full bg-muted-foreground/40'
                        }
                      />
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="min-w-0 p-3 sm:p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Governed users
                </p>
                <h3 className="mt-0.5 font-display text-sm font-semibold tracking-tight text-foreground sm:text-base">
                  Agents on the same roles and policies as people
                </h3>
              </div>

              <ul className="mt-4 divide-y divide-border/80 overflow-hidden rounded-lg border border-border/80">
                {AGENT_ROWS.map((agent) => (
                  <li
                    key={agent.name}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-3.5"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium text-foreground">{agent.name}</p>
                      <p className="mt-0.5 text-xs leading-5 text-body">{agent.role}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-secondary px-2 text-xs text-muted-foreground">
                        <StatusDot status={agent.status} label={agent.statusLabel} />
                        {agent.statusLabel}
                      </span>
                      <VerdictChip verdict={agent.verdict} actor="policy" asOf={agent.asOf} />
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Live presentation components. Agents are users with policy, not a separate stack.
              </p>
            </div>
          </div>
        </div>
      </div>

      {caption && (
        <figcaption className="mt-4 text-center text-sm leading-6 text-body">
          {caption.prefix}{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {caption.code}
          </code>{' '}
          {caption.suffix}
        </figcaption>
      )}
    </figure>
  );
}
