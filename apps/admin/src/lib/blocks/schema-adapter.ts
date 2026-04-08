/**
 * Schema Adapter Layer
 *
 * Bridges between generated types from @/types and contract types from @revealui/contracts.
 * This adapter handles the transformation and validation of blocks to ensure type safety
 * and runtime validation.
 */

import {
  type Block,
  BlockSchema,
  type ButtonBlock,
  ButtonBlockSchema,
  type CodeBlock,
  CodeBlockSchema,
  type FormBlock,
  FormBlockSchema,
  type ImageBlock,
  ImageBlockSchema,
  type TextBlock,
  TextBlockSchema,
  type VideoBlock,
  VideoBlockSchema,
} from '@revealui/contracts/content';
import type { Page } from '@revealui/core/types/cms';
import { logger } from '@revealui/utils/logger';
import { z } from 'zod/v4';
// Import country and state options to include in schema blocks
import { countryOptions } from './Form/Country/options';
import { stateOptions } from './Form/State/options';

type GeneratedBlockType = Page['layout'][number];
type GeneratedBlock = NonNullable<GeneratedBlockType>;

/**
 * Result type for safe parsing
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

/**
 * Transforms a generated block to a schema block
 * Note: This is a best-effort transformation. Some blocks may not map perfectly.
 */
export function transformPageBlockToSchema(block: GeneratedBlock): Result<Block, z.ZodError> {
  try {
    const { blockType, id, blockName } = block;

    // Handle form blocks
    if (blockType === 'formBlock' && 'form' in block) {
      // Form blocks in generated types reference a Form collection
      // The form can be a number (ID) or a Form object
      // We need to transform this to match FormBlockSchema
      const formData = block.form;

      // If form is just an ID, we can't transform it (would need to fetch)
      // For now, we'll only transform if form is an object
      if (typeof formData === 'number') {
        return {
          success: false,
          error: new z.ZodError([
            {
              code: 'custom',
              path: ['form'],
              message:
                'Form block contains form ID reference. Form data must be populated to transform.',
            },
          ]),
        };
      }

      // Transform form fields from generated type to schema type
      const transformedFields = (formData.fields || [])
        .map((field, fieldIndex) => {
          // Skip message fields as they're not form inputs
          if (field.blockType === 'message') {
            return null;
          }

          // Map blockType to schema type
          // Note: country, state, and number fields are rendered as select/text inputs
          // but the schema only supports: text, email, password, textarea, select, checkbox, radio, file
          const fieldTypeMap: Record<
            string,
            'text' | 'email' | 'textarea' | 'select' | 'checkbox'
          > = {
            text: 'text',
            email: 'email',
            textarea: 'textarea',
            select: 'select',
            checkbox: 'checkbox',
            number: 'text', // Number fields map to text in schema (validation happens at form level)
            country: 'select', // Country fields should be select with country options
            state: 'select', // State fields should be select with state options
          };

          const schemaType = fieldTypeMap[field.blockType];
          if (!schemaType) {
            logger.warn('Unknown form field type, skipping', {
              blockType: field.blockType,
            });
            return null;
          }

          // Handle select fields with options (including country/state)
          let options: Array<{ value: string; label: string }> | undefined;
          if (schemaType === 'select') {
            if ('options' in field && field.options && Array.isArray(field.options)) {
              // Standard select field with options
              options = field.options.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }));
            } else if (field.blockType === 'country') {
              // Country fields: load options from country options module
              options = countryOptions.map((opt: { value: string; label: string }) => ({
                value: opt.value,
                label: opt.label,
              }));
            } else if (field.blockType === 'state') {
              // State fields: load options from state options module
              options = stateOptions.map((opt: { value: string; label: string }) => ({
                value: opt.value,
                label: opt.label,
              }));
            }
          }

          // Ensure required fields are present
          if (!field.name) {
            logger.warn('Form field missing name, skipping', { fieldIndex });
            return null;
          }

          return {
            id: field.id || field.name || `field-${fieldIndex}`,
            type: schemaType,
            name: field.name,
            label: field.label || field.name || 'Untitled field',
            placeholder: undefined, // Generated type doesn't have placeholder
            required: field.required ?? false,
            options,
          };
        })
        .filter((field): field is NonNullable<typeof field> => field !== null);

      const formBlock: FormBlock = {
        id: id || `block-${Date.now()}`,
        type: 'form',
        data: {
          method: 'POST',
          fields: transformedFields,
          submitText: formData.submitButtonLabel || 'Submit',
          action: undefined, // Generated type doesn't have action URL
        },
        meta: {
          version: 1,
          description: blockName ?? undefined,
        },
      };

      // Validate the transformed block
      const parsed = FormBlockSchema.safeParse(formBlock);
      if (parsed.success) {
        return { success: true, data: parsed.data };
      }
      return { success: false, error: parsed.error };
    }

    // Handle CTA blocks -> Button blocks
    if (blockType === 'cta' && 'links' in block) {
      const firstLink = block.links?.[0];
      if (!firstLink?.link?.label) {
        return {
          success: false,
          error: new z.ZodError([
            {
              code: 'custom',
              path: ['links'],
              message: 'CTA block must have at least one link with a label',
            },
          ]),
        };
      }

      // Create complete ButtonBlock with all required fields
      const buttonBlock: ButtonBlock = {
        id: id || `block-${Date.now()}`,
        type: 'button',
        data: {
          text: firstLink.link.label,
          href: firstLink.link.url || firstLink.link.reference?.value?.toString() || undefined,
          action: 'link',
          variant: firstLink.link.appearance === 'outline' ? 'outline' : 'primary',
          size: 'md',
        },
        meta: {
          version: 1,
          description: blockName ?? undefined,
        },
      };

      // Validate the complete block
      const parsed = ButtonBlockSchema.safeParse(buttonBlock);
      if (parsed.success) {
        return { success: true, data: parsed.data };
      }
      return { success: false, error: parsed.error };
    }

    // Handle content blocks -> Text blocks
    if (blockType === 'content' && 'columns' in block) {
      // Content blocks have columns with rich text
      // Extract text content from the first column's rich text
      const firstColumn = block.columns?.[0];
      const richText = firstColumn?.richText;

      // Extract text from Lexical rich text structure
      const extractTextFromLexical = (node: unknown): string => {
        if (typeof node !== 'object' || node === null) return '';
        if ('text' in node && typeof node.text === 'string') return node.text;
        if ('children' in node && Array.isArray(node.children)) {
          return node.children.map(extractTextFromLexical).join('');
        }
        return '';
      };

      const textContent = richText ? extractTextFromLexical(richText.root) : '';

      // Create complete TextBlock with all required fields
      const textBlock: TextBlock = {
        id: id || `block-${Date.now()}`,
        type: 'text',
        data: {
          content: textContent,
          format: 'tiptap',
        },
        meta: {
          version: 1,
          description: blockName ?? undefined,
        },
      };

      // Validate the complete block
      const parsed = TextBlockSchema.safeParse(textBlock);
      if (parsed.success) {
        return { success: true, data: parsed.data };
      }
      return { success: false, error: parsed.error };
    }

    // Handle media blocks -> Image/Video blocks
    if (blockType === 'mediaBlock' && 'media' in block) {
      const media = block.media;
      if (typeof media === 'object' && media !== null && 'url' in media) {
        const mediaUrl = media.url;
        const mimeType = media.mimeType || '';

        // Validate URL is present and valid
        if (!mediaUrl || typeof mediaUrl !== 'string') {
          return {
            success: false,
            error: new z.ZodError([
              {
                code: 'custom',
                path: ['media', 'url'],
                message: 'Media block must have a valid URL',
              },
            ]),
          };
        }

        // Determine if it's a video
        if (mimeType.startsWith('video/')) {
          // Create complete VideoBlock with all required fields
          const videoBlock: VideoBlock = {
            id: id || `block-${Date.now()}`,
            type: 'video',
            data: {
              src: mediaUrl,
              controls: true,
              autoplay: false,
              loop: false,
              muted: false,
            },
            meta: {
              version: 1,
              description: blockName ?? undefined,
            },
          };

          const parsed = VideoBlockSchema.safeParse(videoBlock);
          if (parsed.success) {
            return { success: true, data: parsed.data };
          }
          return { success: false, error: parsed.error };
        } else {
          // Image block - requires src (URL) and alt
          const imageBlock: ImageBlock = {
            id: id || `block-${Date.now()}`,
            type: 'image',
            data: {
              src: mediaUrl,
              alt: media.alt || '',
              caption: media.caption ? JSON.stringify(media.caption) : undefined,
              width: typeof media.width === 'number' ? media.width : undefined,
              height: typeof media.height === 'number' ? media.height : undefined,
              loading: 'lazy',
            },
            meta: {
              version: 1,
              description: blockName ?? undefined,
            },
          };

          const parsed = ImageBlockSchema.safeParse(imageBlock);
          if (parsed.success) {
            return { success: true, data: parsed.data };
          }
          return { success: false, error: parsed.error };
        }
      }
    }

    // Handle code blocks
    if (blockType === 'code' && 'code' in block) {
      // Create complete CodeBlock with all required fields
      const codeBlock: CodeBlock = {
        id: id || `block-${Date.now()}`,
        type: 'code',
        data: {
          code: block.code || '',
          language: block.language || undefined,
          showLineNumbers: false,
        },
        meta: {
          version: 1,
          description: blockName ?? undefined,
        },
      };

      const parsed = CodeBlockSchema.safeParse(codeBlock);
      if (parsed.success) {
        return { success: true, data: parsed.data };
      }
      return { success: false, error: parsed.error };
    }

    // For blocks that don't have direct schema equivalents (archive, banner, etc.)
    // Return a generic component block
    const componentBlock = {
      id: id || `block-${Date.now()}`,
      type: 'component' as const,
      data: {
        componentId: blockType,
        props: block,
        source: 'builtin' as const,
      },
      meta: {
        version: 1,
      },
    };

    const parsed = BlockSchema.safeParse(componentBlock);
    if (parsed.success) {
      return { success: true, data: parsed.data };
    }

    return {
      success: false,
      error: new z.ZodError([
        {
          code: 'custom',
          path: [],
          message: `Unable to transform block type: ${blockType}`,
        },
      ]),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof z.ZodError
          ? error
          : new z.ZodError([
              {
                code: 'custom',
                path: [],
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            ]),
    };
  }
}

/**
 * Validates and transforms an array of generated blocks to schema blocks
 */
export function validateAndTransformBlocks(blocks: Page['layout']): Result<Block[], z.ZodError> {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { success: true, data: [] };
  }

  const transformedBlocks: Block[] = [];
  const errors: z.ZodError[] = [];

  for (const block of blocks) {
    if (!block) continue;

    const result = transformPageBlockToSchema(block);
    if (result.success) {
      transformedBlocks.push(result.data);
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    // Combine all errors
    const combinedError = new z.ZodError(errors.flatMap((err) => err.issues));
    return { success: false, error: combinedError };
  }

  return { success: true, data: transformedBlocks };
}

/**
 * Validates a block using the BlockSchema
 */
export function validateBlock(block: unknown): Result<Block, z.ZodError> {
  const result = BlockSchema.safeParse(block);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Safe parse a block - returns Result type
 */
export function safeParseBlock(block: unknown): Result<Block, z.ZodError> {
  return validateBlock(block);
}

/**
 * Creates a block from schema format back to generated format
 * This is for reverse transformation if needed
 */
export function createBlockFromSchema(block: Block): GeneratedBlock {
  // This is a simplified reverse transformation
  // In practice, you may need more sophisticated mapping
  const baseBlock = {
    id: block.id,
    blockName: block.meta?.description,
  };

  switch (block.type) {
    case 'button': {
      return {
        ...baseBlock,
        blockType: 'cta' as const,
        links: [
          {
            link: {
              label: block.data.text,
              url: block.data.href,
              appearance: block.data.variant === 'outline' ? 'outline' : 'default',
            },
          },
        ],
      } as GeneratedBlock;
    }

    case 'text': {
      return {
        ...baseBlock,
        blockType: 'content' as const,
        columns: [
          {
            richText: {
              root: {
                type: 'root',
                children: [
                  {
                    type: 'paragraph',
                    text: block.data.content,
                    version: 1,
                  },
                ],
                direction: 'ltr' as const,
                format: '' as const,
                indent: 0,
                version: 1,
              },
            },
            size: 'full' as const,
            enableLink: false,
            // Link is required in ContentBlock type even when enableLink is false
            link: {
              label: '',
              type: null,
              newTab: null,
              reference: null,
              url: null,
              appearance: null,
            },
          },
        ],
      } as GeneratedBlock;
    }

    case 'form': {
      return {
        ...baseBlock,
        blockType: 'formBlock' as const,
        form: {
          id: 0,
          title: 'Form',
          fields: block.data.fields.map(
            (field: { name: string; label: string; required: boolean; type: string }) => ({
              name: field.name,
              label: field.label,
              required: field.required,
              blockType: field.type as 'text' | 'email' | 'textarea' | 'select' | 'checkbox',
            }),
          ),
          submitButtonLabel: block.data.submitText,
          confirmationType: 'message' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      } as GeneratedBlock;
    }

    case 'image': {
      return {
        ...baseBlock,
        blockType: 'mediaBlock' as const,
        media: {
          id: 0,
          url: block.data.src,
          alt: block.data.alt,
          width: block.data.width,
          height: block.data.height,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      } as GeneratedBlock;
    }

    case 'code': {
      return {
        ...baseBlock,
        blockType: 'code' as const,
        code: block.data.code,
        language: block.data.language as 'typescript' | 'javascript' | 'css' | null,
      } as GeneratedBlock;
    }

    default: {
      // For unmapped types, return a minimal block
      return {
        ...baseBlock,
        blockType: 'content' as const,
        columns: [],
      } as GeneratedBlock;
    }
  }
}
