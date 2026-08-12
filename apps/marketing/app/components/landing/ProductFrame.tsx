import { type AuditEvent, AuditLine, StatusDot, VerdictChip } from '@revealui/presentation';

/**
 * Live product-chrome frame for the homepage Demo section.
 *
 * Honest product-as-proof: composed from real `@revealui/presentation`
 * primitives (StatusDot, VerdictChip, AuditLine), not a stale screenshot.
 * Mirrors the receipt motif and the admin shell shape without claiming a
 * pixel-perfect capture of a specific build.
 *
 * Linear craft lesson (linear.app redesign): the product is the proof.
 * Hierarchy + density over decorative chrome.
 */

const SIDEBAR_NAV = [
  { label: 'People', active: false },
  { label: 'Content', active: false },
  { label: 'Offers', active: false },
  { label: 'Payments', active: false },
  { label: 'Agents', active: true },
] as const;

const FRAME_EVENTS: readonly AuditEvent[] = [
  {
    ts: '09:41:07',
    actor: 'support-agent',
    action: 'signed in as',
    object: 'agents@demo.revealui.com',
  },
  {
    ts: '09:41:09',
    actor: 'support-agent',
    action: 'refunded',
    object: 'order #4189',
  },
  {
    ts: '09:41:09',
    actor: 'policy',
    action: 'allowed',
    object: 'refunds under $100',
  },
  {
    ts: '09:41:10',
    actor: 'audit-log',
    action: 'recorded',
    object: 'the receipt',
    refId: 'rcpt_8f3ka91',
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
    <figure className="mx-auto w-full max-w-5xl">
      {/* Product mat: dark outer frame (design system demo pattern), quiet chrome.
          Linear: hierarchy via surface elevation, not brand-colored decoration. */}
      <div
        role="img"
        aria-label={label}
        className="overflow-hidden rounded-2xl bg-foreground p-1.5 shadow-2xl shadow-foreground/10 sm:p-2"
      >
        <div className="overflow-hidden rounded-xl bg-background">
          {/* Window chrome — inverted-L: title bar only; density over ornament */}
          <div className="flex h-10 items-center gap-3 border-b border-border px-3 sm:px-4">
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
            {/* Sidebar — fixed label column alignment (Linear sidebar lesson) */}
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
                          ? 'flex h-8 items-center gap-2 rounded-md bg-foreground/[0.06] px-2 text-xs font-medium text-foreground'
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

            {/* Main pane */}
            <div className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Agent activity
                  </p>
                  <h3 className="mt-1 font-display text-base font-semibold tracking-tight text-foreground">
                    support-agent · refund flow
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-secondary px-2 text-xs text-muted-foreground">
                    <StatusDot status="ok" label="Agent online" pulse />
                    Online
                  </span>
                  <VerdictChip verdict="approve" actor="policy" asOf="09:41" />
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-border/80">
                <div className="flex h-8 items-center border-b border-border/80 px-3">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Live audit trail
                  </p>
                </div>
                <ul className="divide-y divide-border/80">
                  {FRAME_EVENTS.map((event) => (
                    <li
                      key={`${event.ts}-${event.action}-${event.object}`}
                      className="px-3 py-2 sm:px-3.5"
                    >
                      <AuditLine event={event} dense />
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Live presentation components. Same receipt story as the hero, inside an admin shell.
              </p>
            </div>
          </div>
        </div>
      </div>

      {caption && (
        <figcaption className="mt-4 text-center text-sm text-muted-foreground">
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
