/**
 * Block Validation Utilities
 *
 * Provides runtime validation for blocks using Zod schemas.
 * This ensures type safety and data integrity at runtime.
 */

import { type Block, BlockSchema } from '@revealui/contracts/content';
import { z } from 'zod/v4';
import type { Result } from './schema-adapter';

/**
 * Validates a single block using BlockSchema
 */
export function validateBlock(block: unknown): Result<Block, z.ZodError> {
  const result = BlockSchema.safeParse(block);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates an array of blocks
 */
export function validateBlocks(blocks: unknown[]): Result<Block[], z.ZodError> {
  if (!Array.isArray(blocks)) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: 'custom',
          path: [],
          message: 'Blocks must be an array',
        },
      ]),
    };
  }

  const validatedBlocks: Block[] = [];
  const errors: z.ZodError[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const result = validateBlock(block);
    if (result.success) {
      validatedBlocks.push(result.data);
    } else {
      errors.push(
        new z.ZodError(
          result.error.issues.map((err) => ({
            ...err,
            path: [i, ...err.path],
          })),
        ),
      );
    }
  }

  if (errors.length > 0) {
    const combinedError = new z.ZodError(errors.flatMap((err) => err.issues));
    return { success: false, error: combinedError };
  }

  return { success: true, data: validatedBlocks };
}

/**
 * Safe parse a block - returns Result type
 * Alias for validateBlock for consistency
 */
export function safeParseBlock(block: unknown): Result<Block, z.ZodError> {
  return validateBlock(block);
}

/**
 * Validates a block and returns the validated block or throws
 * Use this when you're certain the block should be valid
 */
export function parseBlock(block: unknown): Block {
  return BlockSchema.parse(block);
}

/**
 * Validates blocks and returns the validated blocks or throws
 * Use this when you're certain the blocks should be valid
 */
export function parseBlocks(blocks: unknown[]): Block[] {
  return z.array(BlockSchema).parse(blocks);
}
