import { Button, Stat, StatGroup } from '@revealui/presentation';
import { LIVE_METRICS as M } from '../../content/proof';

/**
 * Live-metrics snapshot. Renders the gate-pinned site.ts METRICS as a dense
 * "live from the repo" strip and links to the claim-drift validator that
 * enforces them. Static (the numbers are build-time constants pinned by CI).
 */
export function LiveMetricsBadge() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {M.eyebrow}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {M.heading}
          </h3>
        </div>
        <Button asChild appearance="link" className="shrink-0 text-sm font-medium">
          <a href={M.validatorHref} target="_blank" rel="noopener noreferrer">
            {M.validatorLabel}
          </a>
        </Button>
      </div>

      <StatGroup className="mt-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {M.metrics.map((m) => (
          <Stat key={m.label} label={m.label} value={m.value} className="p-4 text-center" />
        ))}
      </StatGroup>

      <p className="mt-4 text-sm leading-6 text-body">{M.body}</p>
    </div>
  );
}
