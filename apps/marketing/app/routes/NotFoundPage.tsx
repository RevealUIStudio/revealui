import { Footer } from '../components/Footer';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="flex flex-col items-center justify-center px-6 py-32 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Return home
          </a>
          <a
            href="/products"
            className="inline-flex items-center gap-2 rounded-lg ring-1 ring-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:ring-border/60"
          >
            View products
          </a>
        </div>
      </section>
      <Footer />
    </div>
  );
}
