import { ContactForm } from '../components/ContactForm';
import { Footer } from '../components/Footer';
import { CONTACT_HERO, CONTACT_METHODS } from '../content/contact';

export function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-secondary px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {CONTACT_HERO.title}
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">{CONTACT_HERO.subtitle}</p>
          </div>

          <ContactForm />

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 text-center">
            {CONTACT_METHODS.map((method) => (
              <div key={method.title}>
                <h3 className="text-sm font-semibold text-foreground">{method.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {method.body ? <>{method.body} </> : null}
                  <a
                    href={method.href}
                    target={method.external ? '_blank' : undefined}
                    rel={method.external ? 'noopener noreferrer' : undefined}
                    className="text-primary hover:text-primary/80 underline"
                  >
                    {method.linkLabel}
                  </a>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
