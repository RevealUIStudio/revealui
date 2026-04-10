import type { Category, Post } from '@revealui/core/types/admin';
import { logger } from '@revealui/utils/logger';
import { CollectionArchive } from '@/lib/components/CollectionArchive/index';
import { ErrorBoundary } from '@/lib/components/ErrorBoundary/index';
import RichText from '@/lib/components/RichText/index';
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton';
import { asDocuments } from '@/lib/utils/type-guards';

export interface ArchiveBlockProps {
  introContent?: {
    root: {
      type: string;
      children: {
        type: string;
        version: number;
        [k: string]: unknown;
      }[];
      direction: ('ltr' | 'rtl') | null;
      format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
      indent: number;
      version: number;
    };
    [k: string]: unknown;
  } | null;
  populateBy?: 'collection' | 'selection' | null;
  relationTo?: 'posts' | null;
  categories?: (string | Category)[] | null;
  limit?: number | null;
  selectedDocs?:
    | {
        relationTo: 'posts';
        value: string | Post;
      }[]
    | null;
  id?: string | null;
  blockName?: string | null;
  blockType: 'archive';
}

export const ArchiveBlock = async (props: ArchiveBlockProps) => {
  // Runtime validation - ArchiveBlock is a custom component type
  // Validate required props are present
  if (!props.blockType || props.blockType !== 'archive') {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('ArchiveBlock validation warning: Invalid blockType', {
        blockType: props.blockType,
      });
    }
  }

  const { id, categories, introContent, limit: limitFromProps, populateBy, selectedDocs } = props;
  const limit = limitFromProps || 3;

  let posts: Post[] = [];

  if (populateBy === 'collection') {
    const revealui = await getRevealUIInstance();

    const flattenedCategories = categories?.map((category) =>
      typeof category === 'object' ? category.id : category,
    );

    const fetchedPosts = await revealui.find({
      collection: 'posts',
      depth: 1,
      limit,
      ...(flattenedCategories && flattenedCategories.length > 0
        ? {
            where: {
              categories: {
                in: flattenedCategories,
              },
            },
          }
        : {}),
    });

    posts = asDocuments<Post>(fetchedPosts.docs as unknown[]);
  } else if (selectedDocs?.length) {
    posts = selectedDocs
      .map((doc: { relationTo: 'posts'; value: string | Post }) =>
        typeof doc.value === 'object' ? doc.value : null,
      )
      .filter(Boolean) as Post[];
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="my-16 p-4 border border-red-500 rounded bg-red-50">
          <p className="text-red-700">Error rendering archive block. Please refresh the page.</p>
        </div>
      }
    >
      <div className="my-16" id={`block-${id}`}>
        {introContent && (
          <div className="container mb-16">
            <RichText className="ml-0 max-w-3xl" content={introContent} enableGutter={false} />
          </div>
        )}
        <CollectionArchive posts={posts} />
      </div>
    </ErrorBoundary>
  );
};
