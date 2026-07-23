import { IconPlus } from '@revealui/presentation';
import { FOR_OPERATORS_FAQ } from '../../content/for-operators';

/**
 * Services FAQ stays component-local (not CMS). The cost answer interpolates
 * engagement ladder prices from contracts; claims-safety forbids prices in blocks.
 */
export function Faq() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {FOR_OPERATORS_FAQ.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {FOR_OPERATORS_FAQ.heading}
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-3xl divide-y divide-border">
          {FOR_OPERATORS_FAQ.items.map((item) => (
            <details key={item.question} className="group py-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3 className="text-lg font-semibold leading-7 text-foreground">{item.question}</h3>
                <span className="ml-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-open:rotate-45 group-open:bg-primary/10 group-open:text-primary">
                  <IconPlus size="sm" label="Toggle" />
                </span>
              </summary>
              <div className="mt-4 pr-9 text-base leading-7 text-muted-foreground">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
