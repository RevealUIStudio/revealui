import { ButtonCVA } from '@revealui/presentation';
import { Footer } from '../components/Footer';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="flex flex-col items-center justify-center px-6 py-32 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonCVA asChild variant="brand">
            <a href="/">Return home</a>
          </ButtonCVA>
          <ButtonCVA asChild appearance="outline" variant="neutral">
            <a href="/products">View products</a>
          </ButtonCVA>
        </div>
      </section>
      <Footer />
    </div>
  );
}
