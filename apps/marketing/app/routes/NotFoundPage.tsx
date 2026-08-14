import { Button, MarketingSection } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { NOT_FOUND } from '../content/not-found';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingSection tone="background" density="spacious" width="narrow" className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {NOT_FOUND.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {NOT_FOUND.title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-body">{NOT_FOUND.body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="brand">
            <a href="/">{NOT_FOUND.home}</a>
          </Button>
          <Button asChild appearance="outline" variant="neutral">
            <a href="/products">{NOT_FOUND.products}</a>
          </Button>
        </div>
      </MarketingSection>
      <Footer />
    </div>
  );
}
