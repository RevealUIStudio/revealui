import type { RevealAfterReadHook, RevealDocument } from '@revealui/core';
import type { Page } from '@revealui/core/types/admin';
import { asRecord } from '@/lib/utils/type-guards';

type ArchiveBlockProps = Extract<Page['layout'][0], { blockType: 'archive' }>;

type ArchiveBlockWithDocs = ArchiveBlockProps & {
  populatedDocs: Array<{
    relationTo: 'products' | 'pages' | 'posts' | 'categories';
    value: string;
  }>;
};

/** Narrow a block to an archive block with populated docs via runtime blockType check */
function asArchiveBlock(block: {
  blockType: string;
  [key: string]: unknown;
}): ArchiveBlockWithDocs | null {
  if (block.blockType !== 'archive') return null;

  // Runtime validation: block has blockType 'archive' and is structurally an ArchiveBlockProps.
  // The index-signature parameter type doesn't overlap with ArchiveBlockProps, so we narrow
  // through unknown — the blockType check above provides the runtime safety.
  return block as unknown as ArchiveBlockWithDocs;
}

export const populateArchiveBlock: RevealAfterReadHook = async ({ doc, context, req }) => {
  const revealui = req?.revealui;
  const docRecord = asRecord(doc);
  const docWithLayout = docRecord as {
    layout?: Array<{ blockType: string; [key: string]: unknown }>;
  };

  if (!(docWithLayout.layout && revealui)) return doc as RevealDocument;

  const layout = docWithLayout.layout;

  const layoutWithArchive = await Promise.allSettled(
    layout.map(async (block) => {
      const archiveBlock = asArchiveBlock(block);
      if (archiveBlock) {
        if (archiveBlock.populateBy === 'collection' && !context?.isPopulatingArchiveBlock) {
          const res = await revealui.find({
            collection: archiveBlock?.relationTo || 'products',
            limit: archiveBlock.limit || 10,
            context: { isPopulatingArchiveBlock: true },
            where: {
              ...(archiveBlock?.categories?.length
                ? {
                    categories: {
                      in: archiveBlock.categories.map((cat) =>
                        typeof cat === 'object' ? cat.id : cat,
                      ),
                    },
                  }
                : {}),
            },
            sort: '-publishedOn',
          });

          return {
            ...block,
            populatedDocsTotal: res.totalDocs,
            populatedDocs: res.docs.map((thisDoc) => ({
              relationTo: archiveBlock.relationTo,
              value: String(thisDoc.id),
            })),
          };
        }
      }

      return block;
    }),
  );

  // Extract fulfilled values from the settled promises
  const resolvedLayout = layoutWithArchive
    .map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // For rejected promises, return the original block
      return null;
    })
    .filter(Boolean);

  return { ...doc, layout: resolvedLayout } as RevealDocument;
};
