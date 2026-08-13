import { Heading, LinkButton, Text } from '@revealui/presentation';

export function HomePage(): React.ReactNode {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Heading>RevealUI</Heading>
      <Text className="mt-3">
        Your project is running on the RevealUI-native runtime. Vite plus @revealui/router. No
        Next.js dependency.
      </Text>

      <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6">
        <Heading level={2} className="text-lg">
          Next steps
        </Heading>
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
            your{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              .env.development.local
            </code>{' '}
            is filled in.
          </li>
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <Heading level={2} className="text-lg">
          Try the router
        </Heading>
        <Text className="mt-2 text-sm">
          Click a link below to see client-side navigation in action (a stub 404 page rendered by
          the catch-all route in <code>app/App.tsx</code>):
        </Text>
        <div className="mt-3 flex gap-3 text-sm">
          <LinkButton href="/not-yet-built" appearance="link" size="sm">
            /not-yet-built
          </LinkButton>
        </div>
      </section>

      <Text className="mt-10 text-xs text-gray-500">
        Powered by RevealUI. Primitives for people, content, offers, payments, and agents.
      </Text>
    </main>
  );
}
