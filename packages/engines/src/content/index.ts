/**
 * Content primitive — pages, sites, blocks, rich text, and collections.
 *
 * Re-exports from @revealui/core, @revealui/db, and @revealui/contracts.
 */

// ── Core: configuration & factories ─────────────────────────────────────────
export {
  buildConfig,
  createRevealUI,
  createRevealUICollection,
  createRevealUIField,
  createRevealUIBlock,
  getRevealUI,
  universalPostgresAdapter,
} from '@revealui/core';

// ── Core: rich text ─────────────────────────────────────────────────────────
export {
  lexicalEditor,
  BoldFeature,
  ItalicFeature,
  UnderlineFeature,
  HeadingFeature,
  LinkFeature,
  FixedToolbarFeature,
  serializeLexicalState,
} from '@revealui/core';

// ── Core: access control helpers ────────────────────────────────────────────
export { anyone, authenticated } from '@revealui/core';

// ── Core: plugins ───────────────────────────────────────────────────────────
export {
  formBuilderPlugin,
  nestedDocsPlugin,
  redirectsPlugin,
} from '@revealui/core';

// ── Core: collection & field types ──────────────────────────────────────────
export type {
  Block,
  BlocksField,
  CheckboxField,
  CollectionConfig,
  Field,
  GlobalConfig,
  GroupField,
  TextField,
} from '@revealui/core';

// ── DB: content tables ──────────────────────────────────────────────────────
export {
  pages,
  pageRevisions,
  sites,
  siteCollaborators,
  posts,
  media,
} from '@revealui/db';

// ── Contracts: page schemas ─────────────────────────────────────────────────
export {
  type CreatePageInput,
  CreatePageInputSchema,
  createPage,
  computePagePath,
  estimateWordCount,
  getPageBreadcrumbs,
  isPageLocked,
  isLockedByUser,
  PAGE_SCHEMA_VERSION,
  type Page,
  type PageLock,
  PageLockSchema,
  PageSchema,
  type PageSeo,
  PageSeoSchema,
  type PageStatus,
  PageStatusSchema,
  type UpdatePageInput,
  UpdatePageInputSchema,
} from '@revealui/contracts';

// ── Contracts: site schemas ─────────────────────────────────────────────────
export {
  type CreateSiteInput,
  CreateSiteInputSchema,
  createSite,
  canUserPerformAction,
  canAgentEditSite,
  SITE_SCHEMA_VERSION,
  type Site,
  type SiteCollaborator,
  SiteCollaboratorSchema,
  SiteSchema,
  type SiteSeo,
  SiteSeoSchema,
  type SiteSettings,
  SiteSettingsSchema,
  type SiteStatus,
  SiteStatusSchema,
  type SiteTheme,
  SiteThemeSchema,
  type UpdateSiteInput,
  UpdateSiteInputSchema,
} from '@revealui/contracts';

// ── Contracts: content blocks ───────────────────────────────────────────────
export {
  BLOCK_SCHEMA_VERSION,
  type BlockType,
  type TextBlock,
  type HeadingBlock,
  type ImageBlock,
  type VideoBlock,
  type ButtonBlock,
  type CodeBlock,
  type DividerBlock,
  type SpacerBlock,
  type QuoteBlock,
  type ListBlock,
  type TableBlock,
  type GridBlock,
  type ColumnsBlock,
  type EmbedBlock,
  type AccordionBlock,
  type TabsBlock,
  findBlockById,
  walkBlocks,
  countBlocks,
  isContainerBlock,
  isColumnsBlock,
  isGridBlock,
  isHeadingBlock,
  isImageBlock,
  isTextBlock,
  createTextBlock,
  createHeadingBlock,
  createImageBlock,
  createCodeBlock,
} from '@revealui/contracts';
