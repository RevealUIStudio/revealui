import type { CtaSectionBlock as CtaSectionBlockData } from '@revealui/contracts/content';
import type React from 'react';
import { cn } from '../utils/cn.js';
import type { BlockAnnotation } from './annotation.js';
import { fieldAttrs } from './annotation.js';
import { MarketingLinks } from './marketing-links.js';

export interface CtaSectionBlockProps {
  block: CtaSectionBlockData;
  /** Dot-path of this block within the page array, e.g. `blocks.3`. */
  path: string;
  annotation: BlockAnnotation;
  className?: string;
}

/**
 * Closing call-to-action section with optional CLI snippet. The snippet is
 * display-only static text (never executed). Server-safe: no hooks/state.
 */
export function CtaSectionBlock({
  block,
  path,
  annotation,
  className,
}: CtaSectionBlockProps): React.JSX.Element {
  const { heading, body, links, snippet } = block.data;
  return (
    <section
      className={cn(
        'mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-16 text-center',
        className,
      )}
    >
      <h2
        className="text-balance text-3xl font-semibold tracking-tight text-foreground"
        {...fieldAttrs(annotation, `${path}.heading`)}
      >
        {heading}
      </h2>
      {body ? (
        <p
          className="max-w-2xl text-lg text-muted-foreground"
          {...fieldAttrs(annotation, `${path}.body`)}
        >
          {body}
        </p>
      ) : null}
      {links && links.length > 0 ? (
        <MarketingLinks links={links} className="justify-center" />
      ) : null}
      {snippet ? (
        <figure className="w-full max-w-xl">
          <pre className="overflow-x-auto rounded-[var(--rvui-radius-md)] border border-border bg-card px-4 py-3 text-left font-mono text-sm text-foreground">
            <code {...fieldAttrs(annotation, `${path}.snippet.lines`)}>
              {snippet.lines.join('\n')}
            </code>
          </pre>
          {snippet.caption ? (
            <figcaption
              className="mt-2 text-xs text-muted-foreground"
              {...fieldAttrs(annotation, `${path}.snippet.caption`)}
            >
              {snippet.caption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
    </section>
  );
}
