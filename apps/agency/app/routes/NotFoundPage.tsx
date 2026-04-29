export function NotFoundPage() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-white px-6 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 max-w-md text-base text-gray-600">
          The page you're looking for isn't here. Try the home page or contact us if you think
          something is broken.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <a
            href="/"
            className="inline-flex items-center rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Return home
          </a>
          <a
            href="/contact"
            className="text-sm font-semibold text-gray-600 hover:text-gray-950 transition-colors"
          >
            Contact us →
          </a>
        </div>
      </div>
    </section>
  );
}
