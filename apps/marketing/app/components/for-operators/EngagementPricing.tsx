import { ButtonCVA } from '@revealui/presentation';
import { FOR_OPERATORS_PRICING } from '../../content/for-operators';

export function EngagementPricing() {
  const { eyebrow, heading, body, rungs } = FOR_OPERATORS_PRICING;

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{body}</p>
        </div>

        <ul className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3 list-none p-0">
          {rungs.map((rung) => (
            <li
              key={rung.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm"
            >
              <h3 className="text-lg font-semibold leading-7 text-foreground">{rung.title}</h3>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{rung.price}</p>
              <p className="mt-4 flex-1 text-base leading-7 text-muted-foreground">{rung.body}</p>
              <div className="mt-8">
                <ButtonCVA asChild variant="outline" className="w-full">
                  <a
                    href={rung.cta.href}
                    {...(rung.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {rung.cta.label}
                  </a>
                </ButtonCVA>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
