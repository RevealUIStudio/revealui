import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-2xl font-bold text-gray-900">Page not found</h2>
      <p className="mt-2 text-gray-600">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
      >
        Go home
      </Link>
    </div>
  );
}
