export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">RevealUI</h1>
      <p className="mt-3 text-gray-600">
        Your project is running. Visit{' '}
        <a href="/admin" className="font-medium text-accent hover:text-accent-hover">
          /admin
        </a>{' '}
        to manage content.
      </p>
      <p className="mt-6 text-sm text-gray-500">
        Edit <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">src/app/page.tsx</code> to
        customize this page.
      </p>
    </main>
  )
}
