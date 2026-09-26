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
        backdrop={
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-secondary via-background to-secondary"
          />
        }
      >
        <SectionHeader
          title={CONTACT_HERO.title}
          description={CONTACT_HERO.subtitle}
          titleAs="h1"
          align="center"
          titleClassName="text-4xl sm:text-5xl"
          className="mb-12"
        />
        <div className="space-y-8">
          <ContactForm />
          <div className="grid gap-6 sm:grid-cols-2">
            {CONTACT_METHODS.map((method) => (
              <div key={method.title} className="rounded-2xl bg-card p-6 ring-1 ring-border">
                <h3 className="text-base font-semibold text-foreground">{method.title}</h3>
                <p className="mt-2 text-sm text-body">{method.body}</p>
                <p className="mt-3">
                  <a
                    href={method.href}
                    className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
                  >
                    {method.linkLabel}
                  </a>
                </p>
              </div>
            ))}
          </div>
        </div>
      </MarketingSection>
      <Footer />
    </div>
  );
}
