import { Button, IconSearch } from '@revealui/presentation/server';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <IconSearch className="size-7 text-zinc-400" aria-hidden="true" />
      </div>

      <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">404</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">This page could not be found.</p>
      <p className="mt-1 max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-500">
        The page you're looking for may have been moved or no longer exists.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Button asChild variant="brand">
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild appearance="outline" variant="neutral">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
