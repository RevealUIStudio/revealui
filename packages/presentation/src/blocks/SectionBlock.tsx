import type { SectionBlock as SectionBlockData } from '@revealui/contracts/content';
import type React from 'react';
import { cn } from '../utils/cn.js';
import type { BlockAnnotation } from './annotation.js';
import { fieldAttrs } from './annotation.js';

export interface SectionBlockProps {
  block: SectionBlockData;
  /** Dot-path of this block within the page array, e.g. `blocks.3`. */
  path: string;
  annotation: BlockAnnotation;
  className?: string;
}

/**
 * Generic titled section with an optional repeater list. Covers the demo-beats,
 * primitive-cards, and FAQ shapes. Server-safe: no hooks/state. Each repeater
 * item's fields are addressed as `blocks.<i>.items.<j>.<field>`.
 */
export function SectionBlock({
  block,
  path,
  annotation,
  className,
}: SectionBlockProps): React.JSX.Element {
  const { eyebrow, heading, body, items } = block.data;
  return (
    <section className={cn('mx-auto max-w-5xl px-6 py-16', className)}>
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow ? (
          <p
            className="text-sm font-medium uppercase tracking-widest text-primary"
            {...fieldAttrs(annotation, `${path}.eyebrow`)}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground"
          {...fieldAttrs(annotation, `${path}.heading`)}
        >
          {heading}
        </h2>
        {body ? (
          <p
            className="mt-4 text-lg text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.body`)}
          >
            {body}
          </p>
        ) : null}
      </div>
      {items && items.length > 0 ? (
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const itemPath = `${path}.items.${index}`;
            const headingText = item.title ?? item.label;
            return (
              <li
                key={`${itemPath}:${headingText ?? item.body}`}
                className="rounded-[var(--rvui-radius-md)] border border-border bg-card p-6 text-left"
              >
                {item.label ? (
                  <p
                    className="text-xs font-medium uppercase tracking-widest text-primary"
                    {...fieldAttrs(annotation, `${itemPath}.label`)}
                  >
                    {item.label}
                  </p>
                ) : null}
                {item.title ? (
                  <h3
                    className="mt-1 text-lg font-semibold text-foreground"
                    {...fieldAttrs(annotation, `${itemPath}.title`)}
                  >
                    {item.title}
                  </h3>
                ) : null}
                <p
                  className="mt-2 text-sm text-muted-foreground"
                  {...fieldAttrs(annotation, `${itemPath}.body`)}
                >
                  {item.body}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
