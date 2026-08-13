import { LIVE_METRICS as M } from '../../content/proof';

/**
 * Live-metrics snapshot. Renders the gate-pinned site.ts METRICS as a dense
 * "live from the repo" strip and links to the claim-drift validator that
 * enforces them. Static (the numbers are build-time constants pinned by CI).
 *
 * Craft pass: less card-in-card chrome; tabular density (Linear-like stats).
 */
export function LiveMetricsBadge() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
            {M.eyebrow}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {M.heading}
          </h3>
        </div>
        <a
          href={M.validatorHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
        >
          {M.validatorLabel}
        </a>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-3 lg:grid-cols-6">
        {M.metrics.map((m) => (
          <div key={m.label} className="bg-card px-3 py-5 text-center sm:px-4 sm:py-6">
            <dd className="font-display text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {m.value}
            </dd>
            <dt className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {m.label}
            </dt>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-sm leading-6 text-body">{M.body}</p>
    </div>
  );
}
