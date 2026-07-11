import { HOME_PROBLEM } from '../../content/home';

export function Problem() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {HOME_PROBLEM.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {HOME_PROBLEM.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{HOME_PROBLEM.body}</p>
        </div>

        {/* Mobile (<md): each capability becomes a card so the RevealUI column is
            never hidden behind a horizontal scrollbar. No sidescroll. */}
        <div className="mt-16 space-y-4 md:hidden">
          <h3 className="sr-only">{HOME_PROBLEM.tableAriaLabel}</h3>
          {HOME_PROBLEM.rows.map((r) => (
            <div
              key={r.capability}
              className="overflow-hidden rounded-2xl bg-card ring-1 ring-border shadow-sm"
            >
              <p className="bg-secondary px-4 py-3 text-sm font-semibold text-foreground">
                {r.capability}
              </p>
              <dl className="divide-y divide-border">
                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {HOME_PROBLEM.columns.sprawl}
                  </dt>
                  <dd className="text-right text-sm text-muted-foreground">{r.sprawl}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {HOME_PROBLEM.columns.agentOnly}
                  </dt>
                  <dd className="text-right text-sm text-muted-foreground">{r.agentOnly}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 bg-primary/5 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {HOME_PROBLEM.columns.revealui}
                  </dt>
                  <dd className="text-right text-sm font-medium text-primary">{r.revealui}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        {/* Tablet/desktop (>=md): full comparison table. Four short columns fit
            within the container at md+, so no horizontal scroll is needed. */}
        <div className="mx-auto mt-16 hidden max-w-6xl overflow-hidden rounded-2xl ring-1 ring-border shadow-sm md:block">
          <table className="w-full text-left text-sm" aria-label={HOME_PROBLEM.tableAriaLabel}>
            <thead>
              <tr className="bg-secondary text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4">
                  {HOME_PROBLEM.columns.capability}
                </th>
                <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4">
                  {HOME_PROBLEM.columns.sprawl}
                </th>
                <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4">
                  {HOME_PROBLEM.columns.agentOnly}
                </th>
                <th scope="col" className="bg-primary/10 px-4 py-3 text-primary sm:px-6 sm:py-4">
                  {HOME_PROBLEM.columns.revealui}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {HOME_PROBLEM.rows.map((r) => (
                <tr key={r.capability} className="hover:bg-secondary/60 transition">
                  <td className="px-4 py-4 font-medium text-foreground sm:px-6">{r.capability}</td>
                  <td className="px-4 py-4 text-muted-foreground sm:px-6">{r.sprawl}</td>
                  <td className="px-4 py-4 text-muted-foreground sm:px-6">{r.agentOnly}</td>
                  <td className="bg-primary/5 px-4 py-4 font-medium text-primary sm:px-6">
                    {r.revealui}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
          {HOME_PROBLEM.footnote}
        </p>

        <p className="mx-auto mt-4 max-w-3xl text-center text-sm text-muted-foreground">
          {HOME_PROBLEM.receiptsAudit.prefix}{' '}
          <a
            href={HOME_PROBLEM.receiptsAudit.href}
            className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
          >
            {HOME_PROBLEM.receiptsAudit.label}
          </a>
        </p>
      </div>
    </section>
  );
}
