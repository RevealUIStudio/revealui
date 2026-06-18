import { Link, useLocation } from '@revealui/router';
import { type Audience, audienceHref } from '../../lib/audience';

// Non-technical first: it is the broader audience and the eventual default.
const OPTIONS: ReadonlyArray<{ value: Audience; label: string }> = [
  { value: 'non-technical', label: 'Non-technical' },
  { value: 'technical', label: 'Technical' },
];

/**
 * Audience switch in the hero (it replaces the former eyebrow pill). Each option
 * is a router Link to `/?for=…`, so switching is a real SSR navigation — the
 * served corpus matches the URL with no client-only state and no flash. Rendered
 * as a <nav> landmark: it is navigation between two views of the page.
 */
export function AudienceToggle({ current }: { current: Audience }) {
  const { search } = useLocation();
  return (
    <nav
      aria-label="Choose your view"
      className="inline-flex items-center gap-1 rounded-full bg-secondary p-1 ring-1 ring-border"
    >
      {OPTIONS.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value}
            to={audienceHref(search, option.value)}
            aria-current={active ? 'true' : undefined}
            className={
              active
                ? 'rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground'
                : 'rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground'
            }
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
