import { Heading, LinkButton, Text } from '@revealui/presentation';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Heading>Welcome to your blog</Heading>
      <Text className="mt-4 text-lg">
        Built with{' '}
        <LinkButton href="https://revealui.com" external appearance="link" size="sm">
          RevealUI
        </LinkButton>
        . Start writing posts from the admin panel, or seed sample data to get started.
      </Text>

      <div className="mt-8 flex flex-wrap gap-3">
        <LinkButton href="/posts" variant="brand">
          Read the blog
        </LinkButton>
        <LinkButton href="/admin" variant="neutral" appearance="outline">
          Open admin panel
        </LinkButton>
      </div>

      <div className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <Heading level={2} className="text-sm font-semibold uppercase tracking-wide">
          Quick start
        </Heading>
        <ol className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">pnpm db:seed</code> add
            sample blog posts
          </li>
          <li>
            Visit{' '}
            <LinkButton href="/admin" appearance="link" size="sm">
              /admin
            </LinkButton>{' '}
            to manage your content
          </li>
          <li>
            Edit <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">src/app/page.tsx</code>{' '}
            to customize this page
          </li>
        </ol>
      </div>
    </main>
  );
}
