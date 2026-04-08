/**
 * Type Bridge/Adapter
 *
 * Bridges between generated types from @/types and contract types from @revealui/contracts.
 * This module provides type guards and conversion utilities for incremental migration
 * while maintaining compatibility between the two type systems.
 */

import type { Block, BlockType } from '@revealui/contracts/content';
import { BlockSchema } from '@revealui/contracts/content';
import type { Page } from '@revealui/core/types/cms';
import { createBlockFromSchema, transformPageBlockToSchema } from './schema-adapter';

// Map generated block types to schema block types
export type GeneratedBlockType = Page['layout'][number]['blockType'];
export type GeneratedBlock = NonNullable<Page['layout'][number]>;

/**
 * Type guard to check if an unknown value is a valid schema Block
 *
 * @param block - Unknown value to check
 * @returns True if block is a valid Block according to BlockSchema
 *
 * @example
 * ```typescript
 * if (isSchemaBlock(unknownValue)) {
 *   // TypeScript now knows unknownValue is Block
 *   unknownValue.type // access properties safely
 * }
 * ```
 */
export function isSchemaBlock(block: unknown): block is Block {
  const result = BlockSchema.safeParse(block);
  return result.success;
}

/**
 * Converts a generated block type to a schema block type
 *
 * This function bridges the gap between the generated types (from @/types)
 * and the contract types (from @revealui/contracts). It handles the transformation
 * of block structures to match the schema format.
 *
 * Note: This is a synchronous wrapper around the async schema-adapter.
 * For async usage, import transformPageBlockToSchema directly from schema-adapter.
 *
 * @param block - Generated block from Page layout
 * @returns Schema Block type
 * @throws Error if transformation fails
 *
 * @example
 * ```typescript
 * const generatedBlock = page.layout[0]
 * const schemaBlock = convertGeneratedBlockToSchema(generatedBlock)
 * // Now you can use schemaBlock with schema validation
 * ```
 */
export function convertGeneratedBlockToSchema(block: Page['layout'][number]): Block {
  // Delegate to the schema-adapter transformation function
  // This maintains the API while using the actual implementation
  const result = transformPageBlockToSchema(block);

  if (!result.success) {
    let errorMessage = 'Unknown error';
    if (result.error instanceof Error) {
      errorMessage = result.error.message;
    } else if (result.error && typeof result.error === 'object' && 'issues' in result.error) {
      const zodError = result.error as { issues: Array<{ message?: string }> };
      errorMessage = zodError.issues[0]?.message || 'Unknown error';
    }
    throw new Error(`Failed to convert generated block to schema: ${errorMessage}`);
  }

  if (!result.data) {
    throw new Error('Failed to convert generated block to schema: No data returned');
  }

  return result.data;
}

/**
 * Converts a schema block type back to a generated block type
 *
 * This is the reverse transformation, useful when you need to convert
 * schema blocks back to the format expected by the CMS.
 *
 * @param block - Schema Block type
 * @returns Generated block type matching Page layout structure
 *
 * @example
 * ```typescript
 * const schemaBlock: Block = { type: 'text', ... }
 * const generatedBlock = convertSchemaBlockToGenerated(schemaBlock)
 * // Now you can use generatedBlock in Page layout
 * ```
 */
export function convertSchemaBlockToGenerated(block: Block): Page['layout'][number] {
  // Delegate to the schema-adapter reverse transformation function
  return createBlockFromSchema(block);
}

/**
 * Type guard to check if a block matches a specific schema block type
 *
 * @param block - Block to check
 * @param blockType - Expected block type
 * @returns True if block matches the specified type
 */
export function isBlockType<T extends BlockType>(
  block: Block,
  blockType: T,
): block is Extract<Block, { type: T }> {
  return block.type === blockType;
}

/**
 * Maps generated block type names to schema block type names
 */
export const BLOCK_TYPE_MAP: Record<GeneratedBlockType, BlockType | 'component'> = {
  cta: 'button',
  content: 'text',
  formBlock: 'form',
  mediaBlock: 'image', // Default, can be video
  code: 'code',
  archive: 'component',
  banner: 'component',
  // Note: reusableContent is not a valid GeneratedBlockType, removed from map
} as const;
