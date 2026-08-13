import { Button } from '@revealui/presentation';
import { useState } from 'react';
import { PROVIDER_SWITCH as P } from '../../content/local-ai';

/**
 * Provider-switch interactive. Toggling Local <-> Frontier changes the model,
 * data locus, cost model, and config line. Anchors the local-AI section; the
 * frontier-pathway made tangible. CSR-only (Vite SPA).
 *
 * Tier-1: mode toggles use @revealui/presentation Button (GAP-398).
 */
type Mode = 'local' | 'frontier';

export function ProviderSwitch() {
  const [mode, setMode] = useState<Mode>('local');
  const active = P.modes[mode];

  return (
    <div className="mx-auto mt-12 max-w-3xl rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{P.eyebrow}</p>
        <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground">
          {P.heading}
        </h3>
      </div>

      <div
        className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1"
        role="tablist"
        aria-label="Provider mode"
      >
        {(['local', 'frontier'] as const).map((m) => {
          const selected = mode === m;
          return (
            <Button
              key={m}
              type="button"
              role="tab"
              aria-selected={selected}
              appearance={selected ? 'solid' : 'ghost'}
              variant={selected ? 'brand' : 'neutral'}
              size="sm"
              onClick={() => setMode(m)}
              className={`w-full justify-center gap-2 rounded-lg ${selected ? 'shadow-sm' : ''}`}
            >
              {P.modes[m].label}
              <span
                className={
                  selected
                    ? 'rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-primary-foreground'
                    : 'rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-primary'
                }
              >
                {P.modes[m].badge}
              </span>
            </Button>
          );
        })}
      </div>

      <dl className="mt-6 divide-y divide-border">
        {P.attributes.map((attr) => (
          <div key={attr.key} className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">{attr.label}</dt>
            <dd
              className={`text-right text-sm font-medium text-foreground ${attr.key === 'config' ? 'font-mono text-primary' : ''}`}
            >
              {active[attr.key as keyof typeof active]}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 rounded-xl bg-secondary/60 p-4 ring-1 ring-border">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {P.constant.label}
        </p>
        <ul className="mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
          {P.constant.items.map((item) => (
            <li key={item} className="text-sm leading-6 text-body">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
