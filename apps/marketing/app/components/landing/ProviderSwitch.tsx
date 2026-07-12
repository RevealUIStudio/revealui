import { useState } from 'react';
import { PROVIDER_SWITCH as P } from '../../content/local-ai';

/**
 * Provider-switch interactive. Toggling Local <-> Frontier changes the model,
 * data locus, cost model, and config line. Anchors the local-AI section; the
 * frontier-pathway made tangible. CSR-only (Vite SPA).
 */
type Mode = 'local' | 'frontier';

export function ProviderSwitch() {
  const [mode, setMode] = useState<Mode>('local');
  const active = P.modes[mode];

  return (
    <div className="mx-auto mt-12 max-w-3xl rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{P.eyebrow}</p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">{P.heading}</h3>
      </div>

      {/* Toggle */}
      <div
        className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1"
        role="tablist"
        aria-label="Provider mode"
      >
        {(['local', 'frontier'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === m
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {P.modes[m].label}
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-primary">
              {P.modes[m].badge}
            </span>
          </button>
        ))}
      </div>

      {/* Changing attributes */}
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

      {/* Constant-either-way row */}
      <div className="mt-4 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/20">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {P.constant.label}
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 list-none p-0">
          {P.constant.items.map((item) => (
            <li key={item} className="text-sm text-foreground">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
