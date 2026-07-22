import type { Block } from '@revealui/contracts/content';
import { BlockSchema } from '@revealui/contracts/content';
import type React from 'react';
import type { BlockAnnotation } from './annotation.js';
import { devWarn, fieldAttrs } from './annotation.js';
import { CtaSectionBlock } from './CtaSectionBlock.js';
import { HeroBlock } from './HeroBlock.js';
import {
  DividerBlockView,
  HeadingBlockView,
  ListBlockView,
  QuoteBlockView,
  SpacerBlockView,
  TextBlockView,
} from './primitive-blocks.js';
import { SectionBlock } from './SectionBlock.js';

export interface RenderBlocksProps {
  /** Page block array (canonical `pages.blocks` shape). */
  blocks: Block[];
  /** Document id for edit-mode annotations. Required for annotations to emit. */
  docId?: string;
  /** When true (with a docId), emit `data-rvui-doc`/`data-rvui-field` on text. */
  editable?: boolean;
}

/**
 * Shared, annotatable block renderer.
 *
 * Validates each block against the canonical `BlockSchema` from
 * `@revealui/contracts` and dispatches to a per-type component. Blocks that fail
 * validation or have no renderer are skipped (with a dev-only diagnostic).
 *
 * Render-only and server-safe: no hooks, no state, no `next/*` imports.
 */
export function RenderBlocks({ blocks, docId, editable }: RenderBlocksProps): React.JSX.Element {
  const annotation: BlockAnnotation = { docId, editable };
  return (
    <>
      {blocks.map((raw, index) => {
        const parsed = BlockSchema.safeParse(raw);
        if (!parsed.success) {
          devWarn(`skipping block at index ${index}: failed schema validation`);
          return null;
        }
        const block = parsed.data as Block;
        // `.data`: every block component addresses its fields as
        // `block.data.<field>` (fieldAttrs paths mirror that), so the path
        // handed down must already point at the data object, not the block
        // itself  -  otherwise a patch lands as a sibling of `data` instead of
        // inside it.
        const path = `blocks.${index}.data`;
        return (
          <BlockView key={block.id || path} block={block} path={path} annotation={annotation} />
        );
      })}
    </>
  );
}

interface BlockViewProps {
  block: Block;
  path: string;
  annotation: BlockAnnotation;
}

function BlockView({ block, path, annotation }: BlockViewProps): React.JSX.Element | null {
  switch (block.type) {
    case 'hero':
      return <HeroBlock block={block} path={path} annotation={annotation} />;
    case 'ctaSection':
      return <CtaSectionBlock block={block} path={path} annotation={annotation} />;
    case 'section':
      return <SectionBlock block={block} path={path} annotation={annotation} />;
    case 'text':
      return <TextBlockView block={block} path={path} annotation={annotation} />;
    case 'heading':
      return <HeadingBlockView block={block} path={path} annotation={annotation} />;
    case 'quote':
      return <QuoteBlockView block={block} path={path} annotation={annotation} />;
    case 'list':
      return <ListBlockView block={block} path={path} annotation={annotation} />;
    case 'divider':
      return <DividerBlockView block={block} />;
    case 'spacer':
      return <SpacerBlockView block={block} />;
    default:
      devWarn(`unsupported block type: ${block.type}`);
      return null;
  }
}

/** Re-exported so consumers can build the same field dot-paths as the renderer. */
export { fieldAttrs };
