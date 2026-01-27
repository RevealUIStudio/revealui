/**
 * Block Schemas
 *
 * Blocks are the atomic content units in RevealUI.
 * Each block type has:
 * - A structured data schema (for agents)
 * - A visual representation hint (for humans)
 * - Transformation rules (for rendering)
 *
 * IMPORTANT: Blocks use discriminated unions for type safety.
 * The `type` field determines which data shape is valid.
 */

import { z } from 'zod/v4'

// =============================================================================
// Schema Version
// =============================================================================

export const BLOCK_SCHEMA_VERSION = 1

// =============================================================================
// Block Style Schema (shared across all blocks)
// =============================================================================

/**
 * Visual styling for blocks (human-adjustable)
 */
export const BlockStyleSchema = z.object({
  /** Text alignment */
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),

  /** Background color */
  backgroundColor: z.string().optional(),

  /** Text color */
  textColor: z.string().optional(),

  /** Padding (CSS value) */
  padding: z.string().optional(),

  /** Margin (CSS value) */
  margin: z.string().optional(),

  /** Border radius */
  borderRadius: z.string().optional(),

  /** Custom CSS class */
  className: z.string().optional(),

  /** Inline styles (escape hatch) */
  style: z.record(z.string(), z.string()).optional(),
})

export type BlockStyle = z.infer<typeof BlockStyleSchema>

// =============================================================================
// Block Metadata Schema (shared across all blocks)
// =============================================================================

export const BlockMetaSchema = z.object({
  /** Schema version for migrations (defaults to current if not specified) */
  version: z.number().int().optional(),

  /** Semantic description for agents */
  description: z.string().optional(),

  /** Tags for categorization */
  tags: z.array(z.string()).optional(),

  /** Whether this block is AI-generated */
  aiGenerated: z.boolean().optional(),

  /** Source prompt (if AI-generated) */
  sourcePrompt: z.string().optional(),

  /** Last editor (user or agent ID) */
  lastEditor: z.string().optional(),

  /** Timestamp of last edit */
  lastEditedAt: z.string().datetime().optional(),
})

export type BlockMeta = z.infer<typeof BlockMetaSchema>

// =============================================================================
// Base Block Schema (common fields)
// =============================================================================

const BaseBlockSchema = z.object({
  /** Unique block ID */
  id: z.string(),

  /** Visual styling */
  style: BlockStyleSchema.optional(),

  /** Block metadata */
  meta: BlockMetaSchema.optional(),
})

// =============================================================================
// Text Block
// =============================================================================

export const TextBlockSchema = BaseBlockSchema.extend({
  type: z.literal('text'),
  data: z.object({
    /** Rich text content (stored as portable format) */
    content: z.string(),
    /** Format of the content */
    format: z.enum(['plain', 'markdown', 'html', 'tiptap']).default('markdown'),
  }),
})

export type TextBlock = z.infer<typeof TextBlockSchema>

// =============================================================================
// Heading Block
// =============================================================================

export const HeadingBlockSchema = BaseBlockSchema.extend({
  type: z.literal('heading'),
  data: z.object({
    text: z.string(),
    level: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
    anchor: z.string().optional(),
  }),
})

export type HeadingBlock = z.infer<typeof HeadingBlockSchema>

// =============================================================================
// Quote Block
// =============================================================================

export const QuoteBlockSchema = BaseBlockSchema.extend({
  type: z.literal('quote'),
  data: z.object({
    content: z.string(),
    attribution: z.string().optional(),
    cite: z.url().optional(),
  }),
})

export type QuoteBlock = z.infer<typeof QuoteBlockSchema>

// =============================================================================
// Code Block
// =============================================================================

export const CodeBlockSchema = BaseBlockSchema.extend({
  type: z.literal('code'),
  data: z.object({
    code: z.string(),
    language: z.string().optional(),
    filename: z.string().optional(),
    showLineNumbers: z.boolean().default(false),
    highlightLines: z.array(z.number().int()).optional(),
  }),
})

export type CodeBlock = z.infer<typeof CodeBlockSchema>

// =============================================================================
// Image Block
// =============================================================================

export const ImageBlockSchema = BaseBlockSchema.extend({
  type: z.literal('image'),
  data: z.object({
    src: z.url(),
    alt: z.string(),
    caption: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    loading: z.enum(['lazy', 'eager']).default('lazy'),
  }),
})

export type ImageBlock = z.infer<typeof ImageBlockSchema>

// =============================================================================
// Video Block
// =============================================================================

export const VideoBlockSchema = BaseBlockSchema.extend({
  type: z.literal('video'),
  data: z.object({
    src: z.url(),
    poster: z.url().optional(),
    autoplay: z.boolean().default(false),
    loop: z.boolean().default(false),
    muted: z.boolean().default(false),
    controls: z.boolean().default(true),
  }),
})

export type VideoBlock = z.infer<typeof VideoBlockSchema>

// =============================================================================
// Embed Block
// =============================================================================

export const EmbedBlockSchema = BaseBlockSchema.extend({
  type: z.literal('embed'),
  data: z.object({
    url: z.url(),
    provider: z.string().optional(),
    html: z.string().optional(),
    aspectRatio: z.string().optional(),
  }),
})

export type EmbedBlock = z.infer<typeof EmbedBlockSchema>

// =============================================================================
// Button Block
// =============================================================================

export const ButtonBlockSchema = BaseBlockSchema.extend({
  type: z.literal('button'),
  data: z.object({
    text: z.string(),
    href: z.string().optional(),
    action: z.enum(['link', 'submit', 'custom']).default('link'),
    variant: z.enum(['primary', 'secondary', 'outline', 'ghost']).default('primary'),
    size: z.enum(['sm', 'md', 'lg']).default('md'),
  }),
})

export type ButtonBlock = z.infer<typeof ButtonBlockSchema>

// =============================================================================
// Divider Block
// =============================================================================

export const DividerBlockSchema = BaseBlockSchema.extend({
  type: z.literal('divider'),
  data: z.object({
    variant: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
    thickness: z.string().optional(),
  }),
})

export type DividerBlock = z.infer<typeof DividerBlockSchema>

// =============================================================================
// Spacer Block
// =============================================================================

export const SpacerBlockSchema = BaseBlockSchema.extend({
  type: z.literal('spacer'),
  data: z.object({
    height: z.string().default('2rem'),
  }),
})

export type SpacerBlock = z.infer<typeof SpacerBlockSchema>

// =============================================================================
// List Block
// =============================================================================

export const ListBlockSchema = BaseBlockSchema.extend({
  type: z.literal('list'),
  data: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        checked: z.boolean().optional(),
      }),
    ),
    variant: z.enum(['unordered', 'ordered', 'checklist']).default('unordered'),
  }),
})

export type ListBlock = z.infer<typeof ListBlockSchema>

// =============================================================================
// Table Block
// =============================================================================

export const TableBlockSchema = BaseBlockSchema.extend({
  type: z.literal('table'),
  data: z.object({
    headers: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
      }),
    ),
    rows: z.array(
      z.object({
        id: z.string(),
        cells: z.array(z.string()),
      }),
    ),
    caption: z.string().optional(),
  }),
})

export type TableBlock = z.infer<typeof TableBlockSchema>

// =============================================================================
// Columns Block (recursive - contains other blocks)
// =============================================================================

// Note: Container blocks use z.lazy() for recursion. TypeScript can't fully
// infer nested types, so we define the schema and export the inferred type.
// The `blocks` field will be typed as `unknown[]` in the schema but we cast
// appropriately in runtime functions.

export const ColumnsBlockSchema = BaseBlockSchema.extend({
  type: z.literal('columns'),
  data: z.object({
    columns: z.array(
      z.object({
        id: z.string(),
        width: z.string().optional(),
        blocks: z.array(z.lazy((): z.ZodTypeAny => BlockSchema)),
      }),
    ),
    gap: z.string().optional(),
  }),
})

export type ColumnsBlock = z.infer<typeof ColumnsBlockSchema>

// =============================================================================
// Grid Block (recursive - contains other blocks)
// =============================================================================

export const GridBlockSchema = BaseBlockSchema.extend({
  type: z.literal('grid'),
  data: z.object({
    columns: z.number().int().min(1).max(12).optional(),
    gap: z.string().optional(),
    items: z.array(
      z.object({
        id: z.string(),
        span: z.number().int().min(1).max(12).optional(),
        blocks: z.array(z.lazy((): z.ZodTypeAny => BlockSchema)),
      }),
    ),
  }),
})

export type GridBlock = z.infer<typeof GridBlockSchema>

// =============================================================================
// Accordion Block (recursive - contains other blocks)
// =============================================================================

export const AccordionBlockSchema = BaseBlockSchema.extend({
  type: z.literal('accordion'),
  data: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        blocks: z.array(z.lazy((): z.ZodTypeAny => BlockSchema)),
        defaultOpen: z.boolean().optional(),
      }),
    ),
    allowMultiple: z.boolean().optional(),
  }),
})

export type AccordionBlock = z.infer<typeof AccordionBlockSchema>

// =============================================================================
// Tabs Block (recursive - contains other blocks)
// =============================================================================

export const TabsBlockSchema = BaseBlockSchema.extend({
  type: z.literal('tabs'),
  data: z.object({
    tabs: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        blocks: z.array(z.lazy((): z.ZodTypeAny => BlockSchema)),
      }),
    ),
    defaultTab: z.string().optional(),
  }),
})

export type TabsBlock = z.infer<typeof TabsBlockSchema>

// =============================================================================
// Form Block
// =============================================================================

export const FormBlockSchema = BaseBlockSchema.extend({
  type: z.literal('form'),
  data: z.object({
    action: z.url().optional(),
    method: z.enum(['GET', 'POST']).default('POST'),
    fields: z.array(
      z.object({
        id: z.string(),
        type: z.enum([
          'text',
          'email',
          'password',
          'textarea',
          'select',
          'checkbox',
          'radio',
          'file',
        ]),
        name: z.string(),
        label: z.string(),
        placeholder: z.string().optional(),
        required: z.boolean().default(false),
        options: z
          .array(
            z.object({
              value: z.string(),
              label: z.string(),
            }),
          )
          .optional(),
      }),
    ),
    submitText: z.string().default('Submit'),
  }),
})

export type FormBlock = z.infer<typeof FormBlockSchema>

// =============================================================================
// HTML Block (escape hatch)
// =============================================================================

export const HtmlBlockSchema = BaseBlockSchema.extend({
  type: z.literal('html'),
  data: z.object({
    html: z.string(),
    /** Whether to sanitize (default: true for security) */
    sanitize: z.boolean().default(true),
  }),
})

export type HtmlBlock = z.infer<typeof HtmlBlockSchema>

// =============================================================================
// Component Block (for custom components)
// =============================================================================

export const ComponentBlockSchema = BaseBlockSchema.extend({
  type: z.literal('component'),
  data: z.object({
    /** Component identifier */
    componentId: z.string(),
    /** Props to pass to the component */
    props: z.record(z.string(), z.unknown()).optional(),
    /** Source of the component */
    source: z.enum(['builtin', 'custom', 'marketplace']).default('builtin'),
  }),
})

export type ComponentBlock = z.infer<typeof ComponentBlockSchema>

// =============================================================================
// Block Union (Discriminated by `type`)
// =============================================================================

/**
 * The complete Block type - a union of all block types.
 * Uses z.union() instead of z.discriminatedUnion() because container blocks
 * use z.lazy() for recursive structures, which is incompatible with
 * discriminatedUnion's strict type requirements.
 *
 * TypeScript will still narrow the type based on the `type` field.
 */
export const BlockSchema = z.union([
  TextBlockSchema,
  HeadingBlockSchema,
  QuoteBlockSchema,
  CodeBlockSchema,
  ImageBlockSchema,
  VideoBlockSchema,
  EmbedBlockSchema,
  ButtonBlockSchema,
  DividerBlockSchema,
  SpacerBlockSchema,
  ListBlockSchema,
  TableBlockSchema,
  ColumnsBlockSchema,
  GridBlockSchema,
  AccordionBlockSchema,
  TabsBlockSchema,
  FormBlockSchema,
  HtmlBlockSchema,
  ComponentBlockSchema,
])

export type Block = z.infer<typeof BlockSchema>

// =============================================================================
// Block Type Enum (for type checking)
// =============================================================================

export const BlockTypes = [
  'text',
  'heading',
  'quote',
  'code',
  'image',
  'video',
  'embed',
  'button',
  'divider',
  'spacer',
  'list',
  'table',
  'columns',
  'grid',
  'accordion',
  'tabs',
  'form',
  'html',
  'component',
] as const

export type BlockType = (typeof BlockTypes)[number]

// =============================================================================
// Block Factories
// =============================================================================

/**
 * Creates a text block
 */
export function createTextBlock(
  id: string,
  content: string,
  format: 'plain' | 'markdown' | 'html' | 'tiptap' = 'markdown',
): TextBlock {
  return {
    id,
    type: 'text',
    data: { content, format },
    meta: { version: BLOCK_SCHEMA_VERSION },
  }
}

/**
 * Creates a heading block
 */
export function createHeadingBlock(
  id: string,
  text: string,
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' = 'h2',
): HeadingBlock {
  return {
    id,
    type: 'heading',
    data: { text, level },
    meta: { version: BLOCK_SCHEMA_VERSION },
  }
}

/**
 * Creates an image block
 */
export function createImageBlock(
  id: string,
  src: string,
  alt: string,
  options?: { caption?: string; width?: number; height?: number },
): ImageBlock {
  return {
    id,
    type: 'image',
    data: { src, alt, loading: 'lazy', ...options },
    meta: { version: BLOCK_SCHEMA_VERSION },
  }
}

/**
 * Creates a code block
 */
export function createCodeBlock(
  id: string,
  code: string,
  language?: string,
  options?: {
    filename?: string
    showLineNumbers?: boolean
    highlightLines?: number[]
  },
): CodeBlock {
  return {
    id,
    type: 'code',
    data: { code, language, showLineNumbers: false, ...options },
    meta: { version: BLOCK_SCHEMA_VERSION },
  }
}

// =============================================================================
// Type Guards
// =============================================================================

export function isTextBlock(block: Block): block is TextBlock {
  return block.type === 'text'
}

export function isHeadingBlock(block: Block): block is HeadingBlock {
  return block.type === 'heading'
}

export function isImageBlock(block: Block): block is ImageBlock {
  return block.type === 'image'
}

export function isColumnsBlock(block: Block): block is ColumnsBlock {
  return block.type === 'columns'
}

export function isGridBlock(block: Block): block is GridBlock {
  return block.type === 'grid'
}

export function isContainerBlock(
  block: Block,
): block is ColumnsBlock | GridBlock | AccordionBlock | TabsBlock {
  return ['columns', 'grid', 'accordion', 'tabs'].includes(block.type)
}

// =============================================================================
// Block Utilities
// =============================================================================

/**
 * Recursively walks all blocks including nested ones
 *
 * Note: Due to Zod's z.lazy() inference limitations with recursive types,
 * we use type assertions for nested blocks. The schemas correctly validate
 * at runtime, but TypeScript needs help with inference.
 */
export function walkBlocks(
  blocks: Block[],
  callback: (block: Block, path: string[]) => void,
  path: string[] = [],
): void {
  for (const block of blocks) {
    callback(block, [...path, block.id])

    if (block.type === 'columns') {
      for (const col of block.data.columns) {
        walkBlocks(col.blocks as Block[], callback, [...path, block.id, col.id])
      }
    } else if (block.type === 'grid') {
      for (const item of block.data.items) {
        walkBlocks(item.blocks as Block[], callback, [...path, block.id, item.id])
      }
    } else if (block.type === 'accordion') {
      for (const item of block.data.items) {
        walkBlocks(item.blocks as Block[], callback, [...path, block.id, item.id])
      }
    } else if (block.type === 'tabs') {
      for (const tab of block.data.tabs) {
        walkBlocks(tab.blocks as Block[], callback, [...path, block.id, tab.id])
      }
    }
  }
}

/**
 * Finds a block by ID (recursively)
 */
export function findBlockById(blocks: Block[], id: string): Block | undefined {
  let found: Block | undefined
  walkBlocks(blocks, (block) => {
    if (block.id === id) {
      found = block
    }
  })
  return found
}

/**
 * Counts all blocks including nested ones
 */
export function countBlocks(blocks: Block[]): number {
  let count = 0
  walkBlocks(blocks, () => count++)
  return count
}
