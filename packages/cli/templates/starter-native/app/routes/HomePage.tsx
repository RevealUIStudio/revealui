import { Link } from '@revealui/router';

export function HomePage(): React.ReactNode {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">RevealUI</h1>
      <p className="mt-3 text-gray-600">
        Your project is running on the RevealUI-native runtime — Vite + @revealui/router. No Next.js
        dependency.
      </p>

      <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Next steps</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            Edit{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              app/routes/HomePage.tsx
            </code>{' '}
            to customize this page.
          </li>
          <li>
            Add routes in{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">app/App.tsx</code> via{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">router.registerRoutes</code>
            .
          </li>
          <li>
            Initialize the CMS database with{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">pnpm db:init</code> once
            your <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">.env.local</code> is
            filled in.
          </li>
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Try the router</h2>
        <p className="mt-2 text-sm text-gray-600">
          Click a link below to see client-side navigation in action (a stub 404 page rendered by
          the catch-all route in <code>app/App.tsx</code>):
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link to="/not-yet-built" className="font-medium text-emerald-600 hover:text-emerald-700">
            /not-yet-built →
          </Link>
        </div>
      </section>

      <p className="mt-10 text-xs text-gray-500">
        Powered by RevealUI — primitives for users, content, products, payments, and intelligence.
      </p>
    </main>
  );
}
