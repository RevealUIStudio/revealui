import { Heading, LinkButton, Text } from '@revealui/presentation';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <Heading className="sm:text-5xl">Your store is live</Heading>
        <Text className="mx-auto mt-4 max-w-xl text-lg">
          Built with{' '}
          <LinkButton href="https://revealui.com" external appearance="link" size="sm">
            RevealUI
          </LinkButton>
          . Add products from the admin panel, configure Stripe for payments, and start selling.
        </Text>

        <div className="mt-8 flex justify-center gap-3">
          <LinkButton href="/products" variant="brand">
            Browse products
          </LinkButton>
          <LinkButton href="/admin" variant="neutral" appearance="outline">
            Admin panel
          </LinkButton>
        </div>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-5">
          <Heading level={3}>Products</Heading>
          <Text className="mt-1 text-sm">
            Manage your catalog with custom fields, images, and pricing.
          </Text>
        </div>
        <div className="rounded-lg border border-gray-200 p-5">
          <Heading level={3}>Payments</Heading>
          <Text className="mt-1 text-sm">
            Stripe integration for checkout, subscriptions, and webhooks.
          </Text>
        </div>
        <div className="rounded-lg border border-gray-200 p-5">
          <Heading level={3}>Orders</Heading>
          <Text className="mt-1 text-sm">
            Track and manage orders with status updates and fulfillment.
          </Text>
        </div>
      </div>

      <div className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <Heading level={2} className="text-sm font-semibold uppercase tracking-wide">
          Quick start
        </Heading>
        <ol className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">pnpm db:seed</code> add
            sample products
          </li>
          <li>
            Add your Stripe keys to{' '}
            <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">
              .env.development.local
            </code>
          </li>
          <li>
            Visit{' '}
            <LinkButton href="/admin" appearance="link" size="sm">
              /admin
            </LinkButton>{' '}
            to manage products and orders
          </li>
        </ol>
      </div>
    </main>
  );
}
