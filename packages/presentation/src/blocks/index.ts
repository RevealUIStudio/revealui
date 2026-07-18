/**
 * Shared block renderer — marketing-shaped section blocks plus thin renderers
 * for the reusable content primitives, with an edit-mode annotation contract.
 *
 * All exports are render-only and server-safe (no hooks, no state).
 */

export {
  type AnnotationAttrs,
  type BlockAnnotation,
  fieldAttrs,
} from './annotation.js';
export { CtaSectionBlock, type CtaSectionBlockProps } from './CtaSectionBlock.js';
export { HeroBlock, type HeroBlockProps } from './HeroBlock.js';
export { MarketingLinks, type MarketingLinksProps } from './marketing-links.js';
export {
  DividerBlockView,
  HeadingBlockView,
  ListBlockView,
  QuoteBlockView,
  SpacerBlockView,
  TextBlockView,
} from './primitive-blocks.js';
export { RenderBlocks, type RenderBlocksProps } from './RenderBlocks.js';
export { SectionBlock, type SectionBlockProps } from './SectionBlock.js';
