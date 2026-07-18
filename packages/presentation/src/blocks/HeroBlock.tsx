import type { HeroBlock as HeroBlockData } from '@revealui/contracts/content';
import type React from 'react';
import { cn } from '../utils/cn.js';
import type { BlockAnnotation } from './annotation.js';
import { fieldAttrs } from './annotation.js';
import { MarketingLinks } from './marketing-links.js';

export interface HeroBlockProps {
  block: HeroBlockData;
  /** Dot-path of this block within the page array, e.g. `blocks.3`. */
  path: string;
  annotation: BlockAnnotation;
  className?: string;
}

/**
 * Full-width lead section. Server-safe (no hooks/state); text-bearing elements
 * carry edit-mode annotations when active.
 */
export function HeroBlock({
  block,
  path,
  annotation,
  className,
}: HeroBlockProps): React.JSX.Element {
  const { eyebrow, title, subtitle, support, links } = block.data;
  return (
    <section
      className={cn(
        'mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center',
        className,
      )}
    >
      {eyebrow ? (
        <p
          className="text-sm font-medium uppercase tracking-widest text-primary"
          {...fieldAttrs(annotation, `${path}.eyebrow`)}
        >
          {eyebrow}
        </p>
      ) : null}
      <h1
        className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
        {...fieldAttrs(annotation, `${path}.title`)}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          className="max-w-2xl text-lg text-muted-foreground"
          {...fieldAttrs(annotation, `${path}.subtitle`)}
        >
          {subtitle}
        </p>
      ) : null}
      {support ? (
        <p className="text-sm text-muted-foreground" {...fieldAttrs(annotation, `${path}.support`)}>
          {support}
        </p>
      ) : null}
      {links && links.length > 0 ? (
        <MarketingLinks links={links} className="justify-center" />
      ) : null}
    </section>
  );
}
