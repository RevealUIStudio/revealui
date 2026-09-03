import { Button, MarketingSection, SectionHeader } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import {
  TEMPLATES_APIFY,
  TEMPLATES_CLI,
  TEMPLATES_CLI_ITEMS,
  TEMPLATES_GITHUB,
  TEMPLATES_HERO,
  TEMPLATES_LICENSES,
  TEMPLATES_VERCEL,
} from '../content/templates';

export function TemplatesPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingSection tone="background" density="default" width="narrow">
        <SectionHeader
          title={TEMPLATES_HERO.title}
          description={TEMPLATES_HERO.subtitle}
          titleAs="h1"
          titleClassName="font-display text-4xl sm:text-5xl"
        />
      </MarketingSection>

      <MarketingSection tone="background" density="compact" width="narrow">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {TEMPLATES_CLI.heading}
        </h2>
        <p className="mt-4 leading-7 text-body">{TEMPLATES_CLI.body}</p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-foreground px-4 py-3 font-mono text-sm text-background">
          <code>{TEMPLATES_CLI.command}</code>
        </pre>
      </MarketingSection>

      <MarketingSection tone="background" density="compact" width="narrow">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {TEMPLATES_VERCEL.heading}
        </h2>
        <p className="mt-4 leading-7 text-body">{TEMPLATES_VERCEL.body}</p>
      </MarketingSection>

      <MarketingSection tone="card" density="default" width="narrow">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {TEMPLATES_GITHUB.heading}
        </h2>
        <p className="mt-4 leading-7 text-body">{TEMPLATES_GITHUB.body}</p>
        <ul className="mt-8 list-none space-y-4 p-0">
          {TEMPLATES_CLI_ITEMS.map((item) => (
            <li key={item.id} className="rounded-2xl bg-background p-6 ring-1 ring-border">
              <h3 className="font-mono text-base font-semibold text-foreground">{item.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.stack}</p>
              <p className="mt-3 text-sm leading-6 text-body">{item.body}</p>
              {item.githubHref ? (
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    className="inline-block text-sm font-medium text-primary hover:underline"
                    href={item.githubHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Use this template: {item.name}
                  </a>
                  {item.deployHref ? (
                    <a
                      className="inline-block text-sm font-medium text-primary hover:underline"
                      href={item.deployHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Deploy to Vercel: {item.name}
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No GitHub twin.</p>
              )}
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection tone="background" density="default" width="narrow">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {TEMPLATES_APIFY.heading}
        </h2>
        <p className="mt-4 leading-7 text-body">{TEMPLATES_APIFY.body}</p>
        <div className="mt-6">
          <Button asChild appearance="outline" variant="neutral">
            <a href={TEMPLATES_APIFY.href} target="_blank" rel="noopener noreferrer">
              {TEMPLATES_APIFY.cta}
            </a>
          </Button>
        </div>
      </MarketingSection>

      <MarketingSection tone="secondary" density="default" width="narrow">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {TEMPLATES_LICENSES.heading}
        </h2>
        <p className="mt-4 leading-7 text-body">{TEMPLATES_LICENSES.body}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand">
            <a href={TEMPLATES_LICENSES.pricing.href}>{TEMPLATES_LICENSES.pricing.label}</a>
          </Button>
          <Button asChild appearance="outline" variant="neutral">
            <a href={TEMPLATES_LICENSES.book.href} target="_blank" rel="noopener noreferrer">
              {TEMPLATES_LICENSES.book.label}
            </a>
          </Button>
        </div>
      </MarketingSection>
      <Footer />
    </div>
  );
}
