import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Your store is live
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
          Built with{' '}
          <a
            href="https://revealui.com"
            className="font-medium text-accent hover:text-accent-hover"
            target="_blank"
            rel="noopener noreferrer"
          >
            RevealUI
          </a>
          . Add products from the admin panel, configure Stripe for payments, and start selling.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/products"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Browse products
          </Link>
          <a
            href="/admin"
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Admin panel
          </a>
        </div>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900">Products</h3>
          <p className="mt-1 text-sm text-gray-600">
            Manage your catalog with custom fields, images, and pricing.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900">Payments</h3>
          <p className="mt-1 text-sm text-gray-600">
            Stripe integration for checkout, subscriptions, and webhooks.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900">Orders</h3>
          <p className="mt-1 text-sm text-gray-600">
            Track and manage orders with status updates and fulfillment.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Quick start</h2>
        <ol className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">pnpm db:seed</code> - add
            sample products
          </li>
          <li>
            Add your Stripe keys to{' '}
            <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">.env.local</code>
          </li>
          <li>
            Visit{' '}
            <a href="/admin" className="text-accent hover:text-accent-hover">
              /admin
            </a>{' '}
            - manage products and orders
          </li>
        </ol>
      </div>
    </main>
  );
}
