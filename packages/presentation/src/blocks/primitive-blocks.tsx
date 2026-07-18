import type {
  DividerBlock,
  HeadingBlock,
  ListBlock,
  QuoteBlock,
  SpacerBlock,
  TextBlock,
} from '@revealui/contracts/content';
import type React from 'react';
import { cn } from '../utils/cn.js';
import type { BlockAnnotation } from './annotation.js';
import { fieldAttrs } from './annotation.js';

interface PrimitiveProps<T> {
  block: T;
  /** Dot-path of this block within the page array, e.g. `blocks.3`. */
  path: string;
  annotation: BlockAnnotation;
}

/**
 * Thin, cheap renderers for the general-purpose primitives the marketing
 * surface reuses. Rich formats (markdown/html/tiptap) render as plain text in
 * P1; a richer pipeline is a later slice.
 */

export function TextBlockView({
  block,
  path,
  annotation,
}: PrimitiveProps<TextBlock>): React.JSX.Element {
  return (
    <p
      className="text-base text-foreground leading-relaxed"
      {...fieldAttrs(annotation, `${path}.content`)}
    >
      {block.data.content}
    </p>
  );
}

export function HeadingBlockView({
  block,
  path,
  annotation,
}: PrimitiveProps<HeadingBlock>): React.JSX.Element {
  const Tag = block.data.level;
  return (
    <Tag
      className="font-semibold text-foreground tracking-tight"
      {...fieldAttrs(annotation, `${path}.text`)}
    >
      {block.data.text}
    </Tag>
  );
}

export function QuoteBlockView({
  block,
  path,
  annotation,
}: PrimitiveProps<QuoteBlock>): React.JSX.Element {
  const { content, attribution } = block.data;
  return (
    <blockquote className="border-primary border-l-2 pl-4 text-muted-foreground italic">
      <p {...fieldAttrs(annotation, `${path}.content`)}>{content}</p>
      {attribution ? (
        <footer
          className="mt-2 text-foreground text-sm not-italic"
          {...fieldAttrs(annotation, `${path}.attribution`)}
        >
          {attribution}
        </footer>
      ) : null}
    </blockquote>
  );
}

export function ListBlockView({
  block,
  path,
  annotation,
}: PrimitiveProps<ListBlock>): React.JSX.Element {
  const { items, variant } = block.data;
  const ListTag = variant === 'ordered' ? 'ol' : 'ul';
  const listClass = cn(
    'space-y-1 text-foreground',
    variant === 'ordered'
      ? 'list-decimal pl-5'
      : variant === 'checklist'
        ? 'pl-0'
        : 'list-disc pl-5',
  );
  return (
    <ListTag className={listClass}>
      {items.map((item, index) => (
        <li key={item.id} {...fieldAttrs(annotation, `${path}.items.${index}.content`)}>
          {variant === 'checklist' ? (item.checked ? '✓ ' : '☐ ') : null}
          {item.content}
        </li>
      ))}
    </ListTag>
  );
}

export function DividerBlockView({ block }: { block: DividerBlock }): React.JSX.Element {
  return (
    <hr
      className={cn(
        'border-border',
        block.data.variant === 'dashed'
          ? 'border-dashed'
          : block.data.variant === 'dotted'
            ? 'border-dotted'
            : 'border-solid',
      )}
    />
  );
}

export function SpacerBlockView({ block }: { block: SpacerBlock }): React.JSX.Element {
  return <div aria-hidden="true" style={{ height: block.data.height }} />;
}
