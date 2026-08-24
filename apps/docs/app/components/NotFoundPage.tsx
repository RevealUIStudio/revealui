import { Link } from '@revealui/router';
import type React from 'react';

interface NotFoundPageProps {
  pathLabel?: string;
  homeHref?: string;
  homeLabel?: string;
}

export function NotFoundPage({
  pathLabel,
  homeHref = '/',
  homeLabel = 'Back to documentation',
}: NotFoundPageProps): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[var(--width-content)] px-8 py-10">
      <h1 className="text-2xl font-bold text-ink">Not Found</h1>
      <p className="mt-2 text-text-secondary">
        {pathLabel
          ? `No documentation page exists for "${pathLabel}".`
          : 'This documentation page does not exist.'}
      </p>
      <Link to={homeHref} className="mt-4 inline-block text-accent hover:underline">
        {homeLabel}
      </Link>
    </div>
  );
}
