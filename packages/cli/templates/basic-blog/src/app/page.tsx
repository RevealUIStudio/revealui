import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900">Welcome to your blog</h1>
      <p className="mt-4 text-lg text-gray-600">
        Built with{' '}
        <a
          href="https://revealui.com"
          className="font-medium text-accent hover:text-accent-hover"
          target="_blank"
          rel="noopener noreferrer"
        >
          RevealUI
        </a>
        . Start writing posts from the admin panel, or seed sample data to get started.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/posts"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Read the blog
        </Link>
        <a
          href="/admin"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Open admin panel
        </a>
      </div>

      <div className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Quick start</h2>
        <ol className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">pnpm db:seed</code> - add
            sample blog posts
          </li>
          <li>
            Visit{' '}
            <a href="/admin" className="text-accent hover:text-accent-hover">
              /admin
            </a>{' '}
            - manage your content
          </li>
          <li>
            Edit <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">src/app/page.tsx</code>{' '}
            - customize this page
          </li>
        </ol>
      </div>
    </main>
  );
}
