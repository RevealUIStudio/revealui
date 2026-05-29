import { FO_HIW_STEPS } from '../../content/for-operators-how-it-works';

export function EngagementSteps() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {FO_HIW_STEPS.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {FO_HIW_STEPS.heading}
          </h2>
        </div>

        <ol className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 list-none p-0">
          {FO_HIW_STEPS.steps.map((step) => (
            <li
              key={step.number}
              className="grid grid-cols-[auto_1fr] gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-mono text-base font-semibold text-primary">
                {step.number}
              </div>
              <div>
                <h3 className="text-lg font-semibold leading-7 text-foreground">{step.title}</h3>
                <p className="mt-2 text-base leading-7 text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
