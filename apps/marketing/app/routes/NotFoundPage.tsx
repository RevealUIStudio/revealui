import { Button, MarketingSection } from '@revealui/presentation';
import { Footer } from '../components/Footer';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingSection tone="background" density="spacious" width="narrow" className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-body">
          The page you're looking for doesn't exist or has moved.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="brand">
            <a href="/">Return home</a>
          </Button>
          <Button asChild appearance="outline" variant="neutral">
            <a href="/products">View products</a>
          </Button>
        </div>
      </MarketingSection>
      <Footer />
    </div>
  );
}
