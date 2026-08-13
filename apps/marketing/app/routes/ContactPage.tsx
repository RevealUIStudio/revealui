import { MarketingSection, SectionHeader } from '@revealui/presentation';
import { ContactForm } from '../components/ContactForm';
import { Footer } from '../components/Footer';
import { CONTACT_HERO, CONTACT_METHODS } from '../content/contact';

export function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingSection
        tone="background"
        density="spacious"
        width="narrow"
        className="relative overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-secondary via-background to-secondary"
        />
        <SectionHeader
          title={CONTACT_HERO.title}
          description={CONTACT_HERO.subtitle}
          titleAs="h1"
          align="center"
          titleClassName="text-4xl sm:text-5xl"
          className="mb-12"
        />

        <ContactForm />

        <div className="mt-16 grid grid-cols-1 gap-4 text-center sm:grid-cols-3 sm:gap-6">
          {CONTACT_METHODS.map((method) => (
            <div
              key={method.title}
              className="rounded-2xl bg-card px-4 py-6 ring-1 ring-border sm:px-5"
            >
              <h3 className="text-sm font-semibold text-foreground">{method.title}</h3>
              <p className="mt-2 text-sm leading-6 text-body">
                {method.body ? <>{method.body} </> : null}
                <a
                  href={method.href}
                  target={method.external ? '_blank' : undefined}
                  rel={method.external ? 'noopener noreferrer' : undefined}
                  className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
                >
                  {method.linkLabel}
                </a>
              </p>
            </div>
          ))}
        </div>
      </MarketingSection>
      <Footer />
    </div>
  );
}
