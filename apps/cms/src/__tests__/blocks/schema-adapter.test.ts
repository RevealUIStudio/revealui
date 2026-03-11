/**
 * Tests for schema adapter
 */

import type { Page } from '@revealui/core/types/cms';
import { describe, expect, it } from 'vitest';
import {
  safeParseBlock,
  transformPageBlockToSchema,
  validateAndTransformBlocks,
  validateBlock,
} from '@/lib/blocks/schema-adapter';

describe('schema-adapter', () => {
  describe('transformPageBlockToSchema', () => {
    it('transforms CTA block to button block', () => {
      const ctaBlock: Page['layout'][0] = {
        blockType: 'cta',
        links: [
          {
            link: {
              label: 'Click me',
              url: 'https://example.com',
              appearance: 'default',
            },
          },
        ],
      };

      const result = transformPageBlockToSchema(ctaBlock);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'button') {
        expect(result.data.type).toBe('button');
        expect(result.data.data.text).toBe('Click me');
      }
    });

    it('transforms form block', () => {
      const formBlock: Page['layout'][0] = {
        blockType: 'formBlock',
        form: {
          id: 1,
          title: 'Test Form',
          fields: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        enableIntro: false,
      };

      const result = transformPageBlockToSchema(formBlock);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('form');
      }
    });

    it('transforms code block', () => {
      const codeBlock: Page['layout'][0] = {
        blockType: 'code',
        code: 'console.log("hello")',
        language: 'javascript',
      };

      const result = transformPageBlockToSchema(codeBlock);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'code') {
        expect(result.data.type).toBe('code');
        expect(result.data.data.code).toBe('console.log("hello")');
      }
    });
  });

  describe('validateAndTransformBlocks', () => {
    it('validates and transforms multiple blocks', () => {
      const blocks: Page['layout'] = [
        {
          blockType: 'cta',
          links: [
            {
              link: {
                label: 'Test',
                url: 'https://example.com',
              },
            },
          ],
        },
        {
          blockType: 'code',
          code: 'test',
        },
      ];

      const result = validateAndTransformBlocks(blocks);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
      }
    });

    it('handles empty blocks array', () => {
      const result = validateAndTransformBlocks([]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(0);
      }
    });
  });

  describe('validateBlock', () => {
    it('validates a valid block', () => {
      const validBlock = {
        id: 'test',
        type: 'text' as const,
        data: {
          content: 'Hello',
          format: 'markdown' as const,
        },
        meta: {
          version: 1,
        },
      };

      const result = validateBlock(validBlock);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid block', () => {
      const invalidBlock = {
        type: 'invalid',
      };

      const result = validateBlock(invalidBlock);
      expect(result.success).toBe(false);
    });
  });

  describe('safeParseBlock', () => {
    it('safely parses a valid block', () => {
      const validBlock = {
        id: 'test',
        type: 'button' as const,
        data: {
          text: 'Click',
          action: 'link' as const,
          variant: 'primary' as const,
          size: 'md' as const,
        },
        meta: {
          version: 1,
        },
      };

      const result = safeParseBlock(validBlock);
      expect(result.success).toBe(true);
    });
  });
});
