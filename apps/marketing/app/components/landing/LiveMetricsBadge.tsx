import { LIVE_METRICS as M } from '../../content/proof';

/**
 * Live-metrics snapshot badge. Renders the gate-pinned site.ts METRICS as a
 * "live from the repo" strip and links to the claim-drift validator that
 * enforces them. Static (the numbers are build-time constants pinned by CI).
 */
export function LiveMetricsBadge() {
  return (
    <div className="mx-auto mb-16 max-w-5xl rounded-2xl bg-secondary p-8 ring-1 ring-border">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            {M.eyebrow}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">{M.heading}</h3>
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

      <dl className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {M.metrics.map((m) => (
          <div key={m.label} className="text-center">
            <dd className="text-3xl font-bold tracking-tight text-foreground">{m.value}</dd>
            <dt className="mt-1 text-xs text-muted-foreground">{m.label}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-6 text-sm leading-6 text-muted-foreground">{M.body}</p>
    </div>
  );
}
