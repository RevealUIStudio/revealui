import { Navigate } from '@revealui/router';
import { useEffect } from 'react';

/**
 * Client-side stand-in for the production 308s in vercel.json. Direct hits on
 * Vercel never reach this component; SPA navigations and local Vite do.
 */
export function MovedPage({ to }: { to: string }) {
  const external = to.startsWith('http');

  useEffect(() => {
    if (external) {
      window.location.replace(to);
    }
  }, [external, to]);

  if (!external) {
    return <Navigate to={to} replace />;
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-body">This page moved.</p>
      <a href={to} className="mt-4 inline-block font-medium text-primary underline">
        Continue
      </a>
    </div>
  );
}
