import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20">
      <p className="text-sm font-medium text-accent">Portfolio</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
        Hi, I&apos;m [Your Name]
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-gray-600">
        I build things for the web. This portfolio is powered by{' '}
        <a
          href="https://revealui.com"
          className="font-medium text-accent hover:text-accent-hover"
          target="_blank"
          rel="noopener noreferrer"
        >
          RevealUI
        </a>{' '}
        - edit your projects from the admin panel, no code changes needed.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/projects"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          View projects
        </Link>
        <a
          href="/admin"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Admin panel
        </a>
      </div>

      <div className="mt-16 border-t border-gray-200 pt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Get started</h2>
        <ol className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            Replace <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">[Your Name]</code>{' '}
            above with your name
          </li>
          <li>
            <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">pnpm db:seed</code> - add
            sample projects
          </li>
          <li>
            Visit{' '}
            <a href="/admin" className="text-accent hover:text-accent-hover">
              /admin
            </a>{' '}
            - add your own projects, links, and tags
          </li>
        </ol>
      </div>
    </main>
  );
}
