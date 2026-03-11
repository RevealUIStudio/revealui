/**
 * Unit tests for block conversion utilities
 *
 * Tests actual utilities from packages/core/src/utils/block-conversion.tsx
 */

import { describe, expect, it } from 'vitest';
import type { Block, RevealUIBlock } from '../../../../../packages/core/src/types/index.js';
// @ts-expect-error - Direct import for testing
import {
  convertFromRevealUIBlock,
  convertToRevealUIBlock,
  enhanceBlockWithRevealUI,
  validateRevealUIBlock,
} from '../../../../../packages/core/src/utils/block-conversion.js';

describe('Block Conversion Utilities', () => {
  const createTestBlock = (): Block => ({
    slug: 'test-block',
    fields: [
      {
        name: 'title',
        type: 'text',
        label: 'Title',
        required: true,
      },
      {
        name: 'content',
        type: 'textarea',
        label: 'Content',
        required: false,
      },
    ],
    labels: {
      singular: 'Test Block',
      plural: 'Test Blocks',
    },
  });

  describe('convertToRevealUIBlock', () => {
    it('should convert standard block to RevealUI block', () => {
      const block = createTestBlock();
      const revealUIBlock = convertToRevealUIBlock(block);

      expect(revealUIBlock.slug).toBe(block.slug);
      expect(revealUIBlock.fields).toHaveLength(block.fields.length);
      expect(revealUIBlock.labels).toEqual(block.labels);
      expect(revealUIBlock.revealUI).toBeDefined();
      expect(revealUIBlock.revealUI.category).toBe('content');
      expect(revealUIBlock.revealUI.icon).toBe('block');
    });

    it('should convert block fields to RevealUI fields', () => {
      const block = createTestBlock();
      const revealUIBlock = convertToRevealUIBlock(block);

      expect(revealUIBlock.fields[0].name).toBe('title');
      expect(revealUIBlock.fields[0].type).toBe('text');
      expect(revealUIBlock.fields[0].label).toBe('Title');
      expect(revealUIBlock.fields[0].required).toBe(true);
      expect(revealUIBlock.fields[0].revealUI).toBeDefined();
    });

    it('should set default RevealUI properties', () => {
      const block = createTestBlock();
      const revealUIBlock = convertToRevealUIBlock(block);

      expect(revealUIBlock.revealUI.permissions).toEqual(['read', 'write']);
      expect(revealUIBlock.revealUI.tenantScoped).toBe(false);
      expect(revealUIBlock.revealUI.preview).toBeUndefined();
    });

    it('should handle blocks without labels', () => {
      const block: Block = {
        slug: 'simple-block',
        fields: [],
      };
      const revealUIBlock = convertToRevealUIBlock(block);

      expect(revealUIBlock.slug).toBe('simple-block');
      expect(revealUIBlock.fields).toHaveLength(0);
    });
  });

  describe('convertFromRevealUIBlock', () => {
    it('should convert RevealUI block back to standard block', () => {
      const block = createTestBlock();
      const revealUIBlock = convertToRevealUIBlock(block);
      const convertedBack = convertFromRevealUIBlock(revealUIBlock);

      expect(convertedBack.slug).toBe(block.slug);
      expect(convertedBack.fields).toHaveLength(block.fields.length);
      expect(convertedBack.labels).toEqual(block.labels);
    });

    it('should strip RevealUI-specific properties', () => {
      const block = createTestBlock();
      const revealUIBlock = convertToRevealUIBlock(block);
      const convertedBack = convertFromRevealUIBlock(revealUIBlock);

      expect(convertedBack.fields[0].name).toBe('title');
      const field = convertedBack.fields[0] as Record<string, unknown>;
      expect(field.revealUI).toBeUndefined();
    });

    it('should preserve field properties', () => {
      const block = createTestBlock();
      const revealUIBlock = convertToRevealUIBlock(block);
      const convertedBack = convertFromRevealUIBlock(revealUIBlock);

      expect(convertedBack.fields[0].type).toBe('text');
      expect(convertedBack.fields[0].label).toBe('Title');
      expect(convertedBack.fields[0].required).toBe(true);
    });
  });

  describe('enhanceBlockWithRevealUI', () => {
    it('should enhance block with RevealUI options', () => {
      const block = createTestBlock();
      const revealUIOptions: RevealUIBlock['revealUI'] = {
        category: 'custom',
        icon: 'custom-icon',
        tenantScoped: true,
        permissions: ['read'],
        preview: undefined,
      };

      const enhanced = enhanceBlockWithRevealUI(block, revealUIOptions);

      expect(enhanced.revealUI.category).toBe('custom');
      expect(enhanced.revealUI.icon).toBe('custom-icon');
      expect(enhanced.revealUI.tenantScoped).toBe(true);
      expect(enhanced.revealUI.permissions).toEqual(['read']);
    });

    it('should merge with default RevealUI properties', () => {
      const block = createTestBlock();
      const revealUIOptions: RevealUIBlock['revealUI'] = {
        tenantScoped: true,
      };

      const enhanced = enhanceBlockWithRevealUI(block, revealUIOptions);

      expect(enhanced.revealUI.tenantScoped).toBe(true);
      expect(enhanced.revealUI.category).toBe('content'); // Default preserved
      expect(enhanced.revealUI.permissions).toEqual(['read', 'write']); // Default preserved
    });

    it('should work without options (use defaults)', () => {
      const block = createTestBlock();
      const enhanced = enhanceBlockWithRevealUI(block);

      expect(enhanced.revealUI).toBeDefined();
      expect(enhanced.revealUI.category).toBe('content');
      expect(enhanced.revealUI.tenantScoped).toBe(false);
    });
  });

  describe('validateRevealUIBlock', () => {
    it('should validate block with valid data', async () => {
      const block = createTestBlock();
      const revealUIBlock = convertToRevealUIBlock(block);

      const data = {
        title: 'Test Title',
        content: 'Test content',
      };

      const context = {
        user: {
          id: '1',
          email: 'user@example.com',
        },
      };

      const errors = await validateRevealUIBlock(revealUIBlock, data, context);
      expect(errors).toEqual({});
    });

    it('should return errors for invalid data', async () => {
      const block = createTestBlock();
      const revealUIBlock = convertToRevealUIBlock(block);

      // Missing required field
      const data = {
        content: 'Test content',
      };

      const context = {
        user: {
          id: '1',
          email: 'user@example.com',
        },
      };

      const errors = await validateRevealUIBlock(revealUIBlock, data, context);
      expect(errors).toHaveProperty('title');
    });

    it('should validate all fields in block', async () => {
      const block: Block = {
        slug: 'multi-field-block',
        fields: [
          {
            name: 'field1',
            type: 'text',
            label: 'Field 1',
            required: true,
          },
          {
            name: 'field2',
            type: 'text',
            label: 'Field 2',
            required: true,
          },
        ],
      };

      const revealUIBlock = convertToRevealUIBlock(block);
      const data = {
        field1: 'value1',
        // Missing field2
      };

      const context = {
        user: {
          id: '1',
          email: 'user@example.com',
        },
      };

      const errors = await validateRevealUIBlock(revealUIBlock, data, context);
      expect(errors).toHaveProperty('field2');
      expect(errors).not.toHaveProperty('field1');
    });
  });
});
