import { describe, expect, it } from 'vitest';
import {
  BLOCK_SCHEMA_VERSION,
  type Block,
  BlockMetaSchema,
  BlockSchema,
  BlockStyleSchema,
  CodeBlockSchema,
  ColumnsBlockSchema,
  countBlocks,
  createCodeBlock,
  createHeadingBlock,
  createImageBlock,
  createTextBlock,
  findBlockById,
  HeadingBlockSchema,
  ImageBlockSchema,
  isColumnsBlock,
  isContainerBlock,
  isHeadingBlock,
  isImageBlock,
  isTextBlock,
  ListBlockSchema,
  TextBlockSchema,
  walkBlocks,
} from '../content/index.js';

describe('Block Schemas', () => {
  describe('Constants', () => {
    it('should export correct schema version', () => {
      expect(BLOCK_SCHEMA_VERSION).toBe(1);
    });
  });

  describe('BlockStyleSchema', () => {
    it('should validate empty style', () => {
      const result = BlockStyleSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate full style', () => {
      const style = {
        align: 'center',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        padding: '1rem',
        margin: '2rem',
        borderRadius: '8px',
        className: 'custom-class',
        style: { fontWeight: 'bold' },
      };
      const result = BlockStyleSchema.safeParse(style);
      expect(result.success).toBe(true);
    });

    it('should reject invalid align value', () => {
      const style = { align: 'invalid' };
      const result = BlockStyleSchema.safeParse(style);
      expect(result.success).toBe(false);
    });
  });

  describe('BlockMetaSchema', () => {
    it('should accept empty meta (version is optional)', () => {
      const result = BlockMetaSchema.parse({});
      expect(result.version).toBeUndefined();
    });

    it('should accept explicit version', () => {
      const result = BlockMetaSchema.parse({ version: BLOCK_SCHEMA_VERSION });
      expect(result.version).toBe(BLOCK_SCHEMA_VERSION);
    });

    it('should validate full meta', () => {
      const meta = {
        version: 1,
        description: 'Test block',
        tags: ['important', 'hero'],
        aiGenerated: true,
        sourcePrompt: 'Create a heading',
        lastEditor: 'user-123',
        lastEditedAt: new Date().toISOString(),
      };
      const result = BlockMetaSchema.safeParse(meta);
      expect(result.success).toBe(true);
    });
  });

  describe('TextBlockSchema', () => {
    it('should validate text block', () => {
      const block = {
        id: 'block-1',
        type: 'text',
        data: {
          content: 'Hello world',
          format: 'markdown',
        },
      };
      const result = TextBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should default format to markdown', () => {
      const block = {
        id: 'block-1',
        type: 'text',
        data: { content: 'Hello' },
      };
      const result = TextBlockSchema.parse(block);
      expect(result.data.format).toBe('markdown');
    });

    it('should reject invalid format', () => {
      const block = {
        id: 'block-1',
        type: 'text',
        data: { content: 'Hello', format: 'invalid' },
      };
      const result = TextBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });
  });

  describe('HeadingBlockSchema', () => {
    it('should validate heading block', () => {
      const block = {
        id: 'block-1',
        type: 'heading',
        data: { text: 'Hello', level: 'h1' },
      };
      const result = HeadingBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should validate all heading levels', () => {
      const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      for (const level of levels) {
        const block = {
          id: 'block-1',
          type: 'heading',
          data: { text: 'Test', level },
        };
        const result = HeadingBlockSchema.safeParse(block);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid level', () => {
      const block = {
        id: 'block-1',
        type: 'heading',
        data: { text: 'Test', level: 'h7' },
      };
      const result = HeadingBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });
  });

  describe('ImageBlockSchema', () => {
    it('should validate image block', () => {
      const block = {
        id: 'block-1',
        type: 'image',
        data: {
          src: 'https://example.com/image.jpg',
          alt: 'An image',
        },
      };
      const result = ImageBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const block = {
        id: 'block-1',
        type: 'image',
        data: {
          src: 'not-a-url',
          alt: 'An image',
        },
      };
      const result = ImageBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('should default loading to lazy', () => {
      const block = {
        id: 'block-1',
        type: 'image',
        data: {
          src: 'https://example.com/image.jpg',
          alt: 'An image',
        },
      };
      const result = ImageBlockSchema.parse(block);
      expect(result.data.loading).toBe('lazy');
    });
  });

  describe('CodeBlockSchema', () => {
    it('should validate code block', () => {
      const block = {
        id: 'block-1',
        type: 'code',
        data: {
          code: 'console.log("hello")',
          language: 'javascript',
        },
      };
      const result = CodeBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should allow highlight lines', () => {
      const block = {
        id: 'block-1',
        type: 'code',
        data: {
          code: 'line1\nline2\nline3',
          language: 'text',
          highlightLines: [1, 3],
        },
      };
      const result = CodeBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });
  });

  describe('ListBlockSchema', () => {
    it('should validate list block', () => {
      const block = {
        id: 'block-1',
        type: 'list',
        data: {
          items: [
            { id: 'item-1', content: 'First item' },
            { id: 'item-2', content: 'Second item' },
          ],
          variant: 'unordered',
        },
      };
      const result = ListBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should validate checklist', () => {
      const block = {
        id: 'block-1',
        type: 'list',
        data: {
          items: [
            { id: 'item-1', content: 'Todo', checked: false },
            { id: 'item-2', content: 'Done', checked: true },
          ],
          variant: 'checklist',
        },
      };
      const result = ListBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });
  });

  describe('ColumnsBlockSchema (recursive)', () => {
    it('should validate columns block', () => {
      const block = {
        id: 'block-1',
        type: 'columns',
        data: {
          columns: [
            {
              id: 'col-1',
              width: '1/2',
              blocks: [{ id: 'nested-1', type: 'text', data: { content: 'Left' } }],
            },
            {
              id: 'col-2',
              width: '1/2',
              blocks: [{ id: 'nested-2', type: 'text', data: { content: 'Right' } }],
            },
          ],
        },
      };
      const result = ColumnsBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should validate deeply nested blocks', () => {
      const block = {
        id: 'block-1',
        type: 'columns',
        data: {
          columns: [
            {
              id: 'col-1',
              blocks: [
                {
                  id: 'nested-columns',
                  type: 'columns',
                  data: {
                    columns: [
                      {
                        id: 'deep-col',
                        blocks: [
                          {
                            id: 'deep-text',
                            type: 'text',
                            data: { content: 'Deep' },
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      };
      const result = ColumnsBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });
  });

  describe('BlockSchema (discriminated union)', () => {
    it('should discriminate by type', () => {
      const textBlock = { id: '1', type: 'text', data: { content: 'Hello' } };
      const result = BlockSchema.safeParse(textBlock);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('text');
      }
    });

    it('should reject unknown type', () => {
      const block = { id: '1', type: 'unknown', data: {} };
      const result = BlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('should reject mismatched data for type', () => {
      // Image block data on text type
      const block = {
        id: '1',
        type: 'text',
        data: { src: 'https://example.com/img.jpg', alt: 'img' },
      };
      const result = BlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });
  });

  describe('Factory Functions', () => {
    describe('createTextBlock', () => {
      it('should create text block with defaults', () => {
        const block = createTextBlock('id-1', 'Hello world');
        expect(block.id).toBe('id-1');
        expect(block.type).toBe('text');
        expect(block.data.content).toBe('Hello world');
        expect(block.data.format).toBe('markdown');
        expect(block.meta?.version).toBe(BLOCK_SCHEMA_VERSION);
      });

      it('should allow custom format', () => {
        const block = createTextBlock('id-1', '<p>Hello</p>', 'html');
        expect(block.data.format).toBe('html');
      });
    });

    describe('createHeadingBlock', () => {
      it('should create heading with default level', () => {
        const block = createHeadingBlock('id-1', 'My Heading');
        expect(block.type).toBe('heading');
        expect(block.data.text).toBe('My Heading');
        expect(block.data.level).toBe('h2');
      });

      it('should allow custom level', () => {
        const block = createHeadingBlock('id-1', 'Title', 'h1');
        expect(block.data.level).toBe('h1');
      });
    });

    describe('createImageBlock', () => {
      it('should create image block', () => {
        const block = createImageBlock('id-1', 'https://example.com/img.jpg', 'Alt text');
        expect(block.type).toBe('image');
        expect(block.data.src).toBe('https://example.com/img.jpg');
        expect(block.data.alt).toBe('Alt text');
        expect(block.data.loading).toBe('lazy');
      });

      it('should allow options', () => {
        const block = createImageBlock('id-1', 'https://example.com/img.jpg', 'Alt', {
          caption: 'My image',
          width: 800,
          height: 600,
        });
        expect(block.data.caption).toBe('My image');
        expect(block.data.width).toBe(800);
        expect(block.data.height).toBe(600);
      });
    });

    describe('createCodeBlock', () => {
      it('should create code block', () => {
        const block = createCodeBlock('id-1', 'const x = 1', 'typescript');
        expect(block.type).toBe('code');
        expect(block.data.code).toBe('const x = 1');
        expect(block.data.language).toBe('typescript');
      });
    });
  });

  describe('Type Guards', () => {
    it('isTextBlock should identify text blocks', () => {
      const text = createTextBlock('1', 'Hello');
      const heading = createHeadingBlock('2', 'Title');

      expect(isTextBlock(text)).toBe(true);
      expect(isTextBlock(heading)).toBe(false);
    });

    it('isHeadingBlock should identify heading blocks', () => {
      const heading = createHeadingBlock('1', 'Title');
      const text = createTextBlock('2', 'Hello');

      expect(isHeadingBlock(heading)).toBe(true);
      expect(isHeadingBlock(text)).toBe(false);
    });

    it('isImageBlock should identify image blocks', () => {
      const image = createImageBlock('1', 'https://example.com/img.jpg', 'Alt');
      const text = createTextBlock('2', 'Hello');

      expect(isImageBlock(image)).toBe(true);
      expect(isImageBlock(text)).toBe(false);
    });

    it('isColumnsBlock should identify columns blocks', () => {
      const columns: Block = {
        id: '1',
        type: 'columns',
        data: { columns: [] },
      };
      const text = createTextBlock('2', 'Hello');

      expect(isColumnsBlock(columns)).toBe(true);
      expect(isColumnsBlock(text)).toBe(false);
    });

    it('isContainerBlock should identify container blocks', () => {
      const columns: Block = {
        id: '1',
        type: 'columns',
        data: { columns: [] },
      };
      const grid: Block = {
        id: '2',
        type: 'grid',
        data: { columns: 2, items: [] },
      };
      const text = createTextBlock('3', 'Hello');

      expect(isContainerBlock(columns)).toBe(true);
      expect(isContainerBlock(grid)).toBe(true);
      expect(isContainerBlock(text)).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    describe('walkBlocks', () => {
      it('should walk flat blocks', () => {
        const blocks: Block[] = [createTextBlock('1', 'First'), createTextBlock('2', 'Second')];

        const visited: string[] = [];
        walkBlocks(blocks, (block) => visited.push(block.id));

        expect(visited).toEqual(['1', '2']);
      });

      it('should walk nested blocks', () => {
        const blocks: Block[] = [
          {
            id: 'columns-1',
            type: 'columns',
            data: {
              columns: [
                {
                  id: 'col-1',
                  blocks: [createTextBlock('nested-1', 'Nested')],
                },
              ],
            },
          },
        ];

        const visited: string[] = [];
        walkBlocks(blocks, (block) => visited.push(block.id));

        expect(visited).toContain('columns-1');
        expect(visited).toContain('nested-1');
      });

      it('should provide path', () => {
        const blocks: Block[] = [
          {
            id: 'columns-1',
            type: 'columns',
            data: {
              columns: [
                {
                  id: 'col-1',
                  blocks: [createTextBlock('nested-1', 'Nested')],
                },
              ],
            },
          },
        ];

        const paths: string[][] = [];
        walkBlocks(blocks, (_, path) => paths.push([...path]));

        expect(paths[0]).toEqual(['columns-1']);
        expect(paths[1]).toEqual(['columns-1', 'col-1', 'nested-1']);
      });
    });

    describe('findBlockById', () => {
      it('should find top-level block', () => {
        const blocks: Block[] = [
          createTextBlock('target', 'Found me'),
          createTextBlock('other', 'Not me'),
        ];

        const found = findBlockById(blocks, 'target');
        expect(found).toBeDefined();
        expect(found?.id).toBe('target');
      });

      it('should find nested block', () => {
        const blocks: Block[] = [
          {
            id: 'columns-1',
            type: 'columns',
            data: {
              columns: [
                {
                  id: 'col-1',
                  blocks: [createTextBlock('nested-target', 'Deep')],
                },
              ],
            },
          },
        ];

        const found = findBlockById(blocks, 'nested-target');
        expect(found).toBeDefined();
        expect(found?.id).toBe('nested-target');
      });

      it('should return undefined for not found', () => {
        const blocks: Block[] = [createTextBlock('1', 'Test')];
        const found = findBlockById(blocks, 'nonexistent');
        expect(found).toBeUndefined();
      });
    });

    describe('countBlocks', () => {
      it('should count flat blocks', () => {
        const blocks: Block[] = [
          createTextBlock('1', 'First'),
          createTextBlock('2', 'Second'),
          createTextBlock('3', 'Third'),
        ];

        expect(countBlocks(blocks)).toBe(3);
      });

      it('should count nested blocks', () => {
        const blocks: Block[] = [
          createTextBlock('1', 'Top'),
          {
            id: 'columns-1',
            type: 'columns',
            data: {
              columns: [
                {
                  id: 'col-1',
                  blocks: [
                    createTextBlock('nested-1', 'Nested 1'),
                    createTextBlock('nested-2', 'Nested 2'),
                  ],
                },
              ],
            },
          },
        ];

        // 1 top + 1 columns + 2 nested = 4
        expect(countBlocks(blocks)).toBe(4);
      });

      it('should return 0 for empty', () => {
        expect(countBlocks([])).toBe(0);
      });
    });
  });
});
