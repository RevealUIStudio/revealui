import { BlockSchema } from '@revealui/contracts/content';
import type { Page } from '@revealui/core/types/cms';
import { logger } from '@revealui/utils/logger';
import type React from 'react';
import { Fragment } from 'react';
import { ErrorBoundary } from '@/lib/components/ErrorBoundary/index';
import { asNormalizedProps } from '@/lib/utils/type-guards';
import { ArchiveBlock } from './ArchiveBlock/Component';
import { CallToActionBlock } from './CallToAction/Component';
import { ContentBlock } from './Content/Component';
import { FormBlock } from './Form/Component';
import { MediaBlock } from './MediaBlock/Component';
import { validateAndTransformBlocks } from './schema-adapter';

// Define individual block types from generated types
type CallToActionBlockProps = Extract<Page['layout'][0], { blockType: 'cta' }>;
type ContentBlockProps = Extract<Page['layout'][0], { blockType: 'content' }>;
type FormBlockProps = Extract<Page['layout'][0], { blockType: 'formBlock' }>;
type ArchiveBlockProps = Extract<Page['layout'][0], { blockType: 'archive' }>;
type MediaBlockProps = Extract<Page['layout'][0], { blockType: 'mediaBlock' }>;

// Combine all block props into a single union type
export type BlockProps =
  | CallToActionBlockProps
  | ContentBlockProps
  | FormBlockProps
  | ArchiveBlockProps
  | MediaBlockProps;

// Type guard to narrow block type for safe prop passing
function isBlockType<T extends BlockProps>(block: BlockProps, blockType: string): block is T {
  return 'blockType' in block && block.blockType === blockType;
}

// Type normalization helpers to bridge generated types and component prop types
// These handle the differences: null vs undefined, number vs string IDs
// Type assertions are used because generated types and component props have structural
// differences but are runtime-compatible (components handle the conversions)
function normalizeArchiveBlockProps(
  block: Extract<Page['layout'][0], { blockType: 'archive' }>,
): ArchiveBlockProps {
  // Type assertion needed because we're converting number IDs to strings
  // The component handles both at runtime
  const normalized = {
    ...block,
    categories: block.categories?.map((cat) => (typeof cat === 'number' ? String(cat) : cat)),
    selectedDocs: block.selectedDocs?.map((doc) => ({
      ...doc,
      value: typeof doc.value === 'number' ? String(doc.value) : doc.value,
    })),
    blockName: block.blockName ?? undefined,
  };
  return asNormalizedProps<ArchiveBlockProps>(normalized);
}
function normalizeFormBlockProps(
  block: Extract<Page['layout'][0], { blockType: 'formBlock' }>,
): FormBlockProps {
  const normalized = {
    ...block,
    blockName: block.blockName ?? undefined,
    enableIntro: block.enableIntro ?? false,
    form: block.form,
    introContent: block.introContent ?? null,
  };
  // Generated types and component props are runtime-compatible but type-incompatible
  return asNormalizedProps<FormBlockProps>(normalized);
}

function normalizeMediaBlockProps(
  block: Extract<Page['layout'][0], { blockType: 'mediaBlock' }>,
): MediaBlockProps & { id?: string } {
  const normalized = {
    ...block,
    id: block.id ?? undefined,
  };
  // MediaBlock props expects undefined but generated type has null
  return asNormalizedProps<MediaBlockProps & { id?: string }>(normalized);
}

/**
 * RenderBlocks Component
 *
 * Renders an array of blocks with runtime validation and error boundaries.
 * Each block is validated against @revealui/contracts before rendering.
 *
 * **IMPORTANT**: By default, validation is enforced (strictMode=true). Invalid blocks
 * will NOT be rendered. Set strictMode=false only for development/debugging.
 *
 * @param blocks - Array of blocks from Page layout
 * @param strictMode - If true (default), invalid blocks are not rendered. If false, invalid blocks are rendered with warnings.
 *
 * @example
 * ```tsx
 * // Default: strict validation (invalid blocks not rendered)
 * <RenderBlocks blocks={page.layout} />
 *
 * // Development mode: allow invalid blocks with warnings
 * <RenderBlocks blocks={page.layout} strictMode={false} />
 * ```
 */
export const RenderBlocks = ({
  blocks,
  strictMode = true,
}: {
  blocks: Page['layout'];
  strictMode?: boolean;
}) => {
  // Validate input
  if (!(blocks && Array.isArray(blocks)) || blocks.length === 0) {
    return null;
  }

  // Transform and validate blocks using schema adapter
  const validationResult = validateAndTransformBlocks(blocks);

  // Additional runtime validation with Zod BlockSchema.parse() for each block
  // This provides an extra layer of validation using the schema types directly
  const validationErrors: Array<{ index: number; error: unknown }> = [];
  blocks.forEach((block, index) => {
    if (!block) return;

    try {
      // Validate against BlockSchema - this ensures the block matches schema structure
      // Note: We validate the transformed block from validationResult if available
      if (validationResult.success && validationResult.data[index]) {
        BlockSchema.parse(validationResult.data[index]);
      }
    } catch (error) {
      validationErrors.push({ index, error });
      if (strictMode) {
        logger.error('Block failed schema validation', { index, error });
      }
    }
  });

  // In strict mode (default), if validation fails, don't render anything
  if (strictMode && (!validationResult.success || validationErrors.length > 0)) {
    const allErrors = validationResult.success
      ? validationErrors
      : [
          ...validationResult.error.issues.map((issue, idx) => ({
            index: idx,
            error: issue,
          })),
          ...validationErrors,
        ];

    logger.error('Block validation failed (strict mode)', {
      errors: allErrors,
    });
    return (
      <div className="my-16 p-4 border border-red-500 rounded bg-red-50">
        <p className="text-red-700 font-semibold">Block validation failed</p>
        <p className="text-red-600 text-sm mt-2">
          {allErrors.length} validation error(s) found. Blocks not rendered.
        </p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-red-600">Show validation errors</summary>
          <pre className="mt-2 p-2 bg-red-100 rounded overflow-auto max-h-48">
            {JSON.stringify(allErrors, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  // In non-strict mode, log errors but continue (development/debugging only)
  if (!strictMode && (!validationResult.success || validationErrors.length > 0)) {
    logger.warn('Block validation errors (non-strict mode)', {
      adapterErrors: validationResult.success ? null : validationResult.error.issues,
      schemaErrors: validationErrors,
    });
  }

  return (
    <Fragment>
      {blocks.map((block, index) => {
        if (!block) {
          return null;
        }

        const { blockType, id } = block;

        // Note: Individual block validation is handled in validateAndTransformBlocks above.
        // We don't validate here again to avoid double validation and type mismatches.
        // The validationResult from validateAndTransformBlocks is the source of truth.

        // Render block with error boundary
        // Type-safe rendering with proper normalization to bridge generated types and component props
        const renderBlock = (): React.ReactNode => {
          try {
            switch (blockType) {
              case 'archive': {
                if (!isBlockType<ArchiveBlockProps>(block, 'archive')) return null;
                const normalizedArchive = asNormalizedProps<
                  React.ComponentProps<typeof ArchiveBlock>
                >(normalizeArchiveBlockProps(block));
                return <ArchiveBlock {...normalizedArchive} />;
              }
              case 'content': {
                if (!isBlockType<ContentBlockProps>(block, 'content')) return null;
                if (!block.columns || block.columns.length === 0) return null;
                // Generated column types and ContentBlock props are structurally compatible
                // but TypeScript can't prove it due to deep nested type differences (null vs undefined)
                const columns = block.columns as React.ComponentProps<
                  typeof ContentBlock
                >['columns'];
                return <ContentBlock {...block} columns={columns} />;
              }
              case 'cta': {
                if (!isBlockType<CallToActionBlockProps>(block, 'cta')) return null;
                return <CallToActionBlock {...block} />;
              }
              case 'formBlock': {
                if (!isBlockType<FormBlockProps>(block, 'formBlock')) return null;
                const normalizedForm = asNormalizedProps<React.ComponentProps<typeof FormBlock>>(
                  normalizeFormBlockProps(block),
                );
                return <FormBlock {...normalizedForm} />;
              }
              case 'mediaBlock': {
                if (!isBlockType<MediaBlockProps>(block, 'mediaBlock')) return null;
                const normalizedMedia = normalizeMediaBlockProps(block);
                return <MediaBlock {...normalizedMedia} />;
              }
              default: {
                logger.warn('No component found for block type', {
                  blockType,
                  index,
                });
                return null;
              }
            }
          } catch (error) {
            logger.error('Error normalizing block', {
              blockType,
              index,
              error,
            });
            return null;
          }
        };

        return (
          <ErrorBoundary
            key={id || `block-${index}`}
            fallback={
              <div className="my-16 p-4 border border-red-500 rounded bg-red-50">
                <p className="text-red-700">Error rendering block: {blockType}</p>
              </div>
            }
          >
            <div className="my-16">{renderBlock()}</div>
          </ErrorBoundary>
        );
      })}
    </Fragment>
  );
};
