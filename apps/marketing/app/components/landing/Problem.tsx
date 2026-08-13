import { MarketingSection, SectionHeader } from '@revealui/presentation';
import { HOME_PROBLEM } from '../../content/home';

/**
 * Capability stack (craft pass 2026-08, Linear redesign principles).
 *
 * One comparison device: capability rows with three aligned answers.
 * Path one-liners were removed (GAP-480 de-dupe) — body + matrix already
 * state the three paths; a second list restated them.
 *
 * Hierarchy from type weight and spacing, not rings or cards.
 * Claims stay in HOME_PROBLEM.rows so claims-evidence export paths hold.
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
    <MarketingSection
      // Secondary band after hero stage — homepage rhythm (GAP-480 Phase C).
      tone="secondary"
      density="default"
      width="default"
    >
      <SectionHeader
        eyebrow={HOME_PROBLEM.eyebrow}
        eyebrowTone="muted"
        title={HOME_PROBLEM.heading}
        description={HOME_PROBLEM.body}
        align="center"
      />

      <ul
        className="mx-auto mt-12 max-w-3xl list-none border-t border-border p-0 sm:mt-14"
        aria-label={HOME_PROBLEM.tableAriaLabel}
      >
        {HOME_PROBLEM.rows.map((row) => (
          <li
            key={row.capability}
            className="border-b border-border py-6 first:pt-8 last:pb-2 sm:py-7 sm:first:pt-9"
          >
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
                        : 'text-sm leading-6 text-body'
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
    </MarketingSection>
  );
}
