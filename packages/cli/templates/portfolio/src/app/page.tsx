import { Heading, LinkButton, Text } from '@revealui/presentation';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20">
      <Text className="text-sm font-medium">Portfolio</Text>
      <Heading className="mt-2">Hi, I&apos;m [Your Name]</Heading>
      <Text className="mt-4 text-lg leading-relaxed">
        I build things for the web. This portfolio is powered by{' '}
        <LinkButton href="https://revealui.com" external appearance="link" size="sm">
          RevealUI
        </LinkButton>
        . Edit your projects from the admin panel, no code changes needed.
      </Text>

      <div className="mt-8 flex gap-3">
        <LinkButton href="/projects" variant="brand">
          View projects
        </LinkButton>
        <LinkButton href="/admin" variant="neutral" appearance="outline">
          Admin panel
        </LinkButton>
      </div>

      <div className="mt-16 border-t border-gray-200 pt-8">
        <Heading level={2} className="text-sm font-semibold uppercase tracking-wide">
          Get started
        </Heading>
        <ol className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            Replace <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">[Your Name]</code>{' '}
            above with your name
          </li>
          <li>
            <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">pnpm db:seed</code> add
            sample projects
          </li>
          <li>
            Visit{' '}
            <LinkButton href="/admin" appearance="link" size="sm">
              /admin
            </LinkButton>{' '}
            to add your own projects, links, and tags
          </li>
        </ol>
      </div>
    </main>
  );
}
