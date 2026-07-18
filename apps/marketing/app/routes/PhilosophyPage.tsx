import { ButtonCVA } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { PHILOSOPHY } from '../content/philosophy';

export function PhilosophyPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-violet-500/10 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {PHILOSOPHY.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {PHILOSOPHY.h1}
          </h1>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          {PHILOSOPHY.sections.map((section, index) => {
            if ('lead' in section && section.lead) {
              return (
                <p
                  key={index}
                  className="text-2xl font-medium leading-relaxed text-foreground sm:text-3xl"
                >
                  {section.body}
                </p>
              );
            }
            if ('footer' in section && section.footer) {
              return (
                <p
                  key={index}
                  className="mt-12 border-t border-border pt-8 text-base font-medium text-muted-foreground"
                >
                  {section.body}
                </p>
              );
            }
            return (
              <p key={index} className="text-lg leading-8 text-muted-foreground">
                {section.body}
              </p>
            );
          })}
        </div>
      </section>

      <section className="px-6 pb-24 sm:pb-32 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 sm:flex-row">
          <ButtonCVA asChild size="lg" variant="brand">
            <a href={PHILOSOPHY.cta.primary.href}>{PHILOSOPHY.cta.primary.label}</a>
          </ButtonCVA>
          <ButtonCVA asChild size="lg" appearance="outline" variant="neutral">
            <a href={PHILOSOPHY.cta.secondary.href} target="_blank" rel="noopener noreferrer">
              {PHILOSOPHY.cta.secondary.label}
            </a>
          </ButtonCVA>
        </div>
      </section>

      <Footer />
    </div>
  );
}
