import { HOME_PROBLEM } from '../../content/home';

/**
 * Capability stack (craft pass 2026-08, Linear redesign principles).
 *
 * Replaces:
 * - desktop spreadsheet table
 * - mobile per-capability cards that restated the matrix
 * - three marketing "path" cards (still too much chrome)
 *
 * One layout at every breakpoint: capability rows with three aligned answers.
 * Hierarchy comes from type weight and spacing, not rings, fills, or boxes.
 * Claims stay in HOME_PROBLEM.rows so claims-evidence export paths hold.
 *
 * Linear lessons applied:
 * - reduce visual noise
 * - maintain visual alignment (label column + answer column)
 * - increase hierarchy via density, not decoration
 * - limit brand chrome; neutral surfaces
 */

interface Answer {
  readonly label: string;
  readonly value: string;
  readonly emphasis: boolean;
}

function answersFor(row: (typeof HOME_PROBLEM.rows)[number]): readonly Answer[] {
  return [
    {
      label: HOME_PROBLEM.columns.sprawl,
      value: row.sprawl,
      emphasis: false,
    },
    {
      label: HOME_PROBLEM.columns.agentOnly,
      value: row.agentOnly,
      emphasis: false,
    },
    {
      label: HOME_PROBLEM.columns.revealui,
      value: row.revealui,
      emphasis: true,
    },
  ];
}

export function Problem() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {HOME_PROBLEM.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {HOME_PROBLEM.heading}
          </h2>
          <p className="mt-5 text-lg leading-8 text-body">{HOME_PROBLEM.body}</p>
        </div>

        {/* Path blurbs: three quiet lines under the intro, not three cards. */}
        <ul
          className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 text-left sm:mt-12"
          aria-label="Three paths"
        >
          {(
            [
              ['sprawl', HOME_PROBLEM.columns.sprawl, HOME_PROBLEM.pathBlurbs.sprawl, false],
              [
                'agentOnly',
                HOME_PROBLEM.columns.agentOnly,
                HOME_PROBLEM.pathBlurbs.agentOnly,
                false,
              ],
              ['revealui', HOME_PROBLEM.columns.revealui, HOME_PROBLEM.pathBlurbs.revealui, true],
            ] as const
          ).map(([id, name, blurb, emphasis]) => (
            <li
              key={id}
              className="grid grid-cols-1 gap-1 sm:grid-cols-[11rem_1fr] sm:gap-6 sm:items-baseline"
            >
              <span
                className={
                  emphasis
                    ? 'text-sm font-semibold text-foreground'
                    : 'text-sm font-medium text-muted-foreground'
                }
              >
                {emphasis ? (
                  <>
                    <span className="mr-2 text-[11px] font-semibold uppercase tracking-widest text-primary">
                      {HOME_PROBLEM.highlightedLabel}
                    </span>
                    <span className="block sm:inline">{name}</span>
                  </>
                ) : (
                  name
                )}
              </span>
              <span
                className={
                  emphasis
                    ? 'text-sm leading-6 text-foreground'
                    : 'text-sm leading-6 text-muted-foreground'
                }
              >
                {blurb}
              </span>
            </li>
          ))}
        </ul>

        <ul
          className="mx-auto mt-14 max-w-3xl list-none border-t border-border p-0 sm:mt-16"
          aria-label={HOME_PROBLEM.tableAriaLabel}
        >
          {HOME_PROBLEM.rows.map((row) => (
            <li key={row.capability} className="border-b border-border py-8 first:pt-10 last:pb-2">
              <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {row.capability}
              </h3>
              <dl className="mt-4 space-y-3">
                {answersFor(row).map((answer) => (
                  <div
                    key={answer.label}
                    className="grid grid-cols-1 gap-0.5 sm:grid-cols-[11rem_1fr] sm:items-baseline sm:gap-6"
                  >
                    <dt
                      className={
                        answer.emphasis
                          ? 'text-sm font-semibold text-foreground'
                          : 'text-sm text-muted-foreground'
                      }
                    >
                      {answer.label}
                    </dt>
                    <dd
                      className={
                        answer.emphasis
                          ? 'text-sm leading-6 font-medium text-foreground'
                          : 'text-sm leading-6 text-muted-foreground'
                      }
                    >
                      {answer.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-muted-foreground">
          {HOME_PROBLEM.footnote}
        </p>
      </div>
    </section>
  );
}
