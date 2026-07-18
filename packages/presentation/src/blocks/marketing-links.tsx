import type { MarketingLink } from '@revealui/contracts/content';
import type React from 'react';
import { buttonVariants } from '../components/Button.js';
import { cn } from '../utils/cn.js';

export interface MarketingLinksProps {
  links: MarketingLink[];
  className?: string;
}

/**
 * Renders a row of marketing CTA links as branded anchors. `primary` maps to the
 * filled brand button, everything else to a neutral outline. Server-safe: plain
 * anchors styled with the shared `buttonVariants`, no hooks.
 */
export function MarketingLinks({ links, className }: MarketingLinksProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {links.map((link) => {
        const isPrimary = link.variant === 'primary';
        return (
          <a
            key={`${link.href}:${link.label}`}
            href={link.href}
            className={buttonVariants(
              isPrimary
                ? { appearance: 'solid', variant: 'brand', size: 'lg' }
                : { appearance: 'outline', variant: 'neutral', size: 'lg' },
            )}
          >
            {link.label}
          </a>
        );
      })}
    </div>
  );
}
