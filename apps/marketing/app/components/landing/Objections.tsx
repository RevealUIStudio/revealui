import { ButtonCVA } from '@revealui/presentation';
import { HOME_OBJECTIONS } from '../../content/home';

export function Objections() {
  return (
    <section className="bg-secondary py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {HOME_OBJECTIONS.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {HOME_OBJECTIONS.heading}
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
          {HOME_OBJECTIONS.cards.map((card) => (
            <div
              key={card.heading}
              className="rounded-2xl bg-card p-8 ring-1 ring-border shadow-sm"
            >
              <h3 className="text-lg font-semibold text-foreground">{card.heading}</h3>
              <p className="mt-3 text-base leading-7 text-muted-foreground">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <ButtonCVA
            asChild
            variant="link"
            size="default"
            className="items-center justify-center text-sm font-medium"
          >
            <a href={HOME_OBJECTIONS.cta.href}>{HOME_OBJECTIONS.cta.label}</a>
          </ButtonCVA>
        </div>
      </div>
    </section>
  );
}
