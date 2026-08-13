import { FRONTIER_PATHWAY as F } from '../../content/local-ai';

/**
 * Frontier-pathway visual: a two-step progression (open-weight default -> add
 * an adapter). Static (no state); pairs with the interactive ProviderSwitch in
 * the local-AI section.
 */
export function FrontierPathway() {
  return (
    <div className="mx-auto mt-12 max-w-4xl">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{F.eyebrow}</p>
        <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground">
          {F.heading}
        </h3>
      </div>

      <ol className="mt-8 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
        {F.steps.map((step) => (
          <li key={step.n} className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
              {step.n}
            </span>
            <h4 className="mt-4 text-base font-semibold tracking-tight text-foreground">
              {step.title}
            </h4>
            <p className="mt-2 text-sm leading-6 text-body">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
