import type { RevealAfterReadHook, RevealDocument, RevealRequest, RevealUIInstance } from '@revealui/core'
import type { Page } from '@revealui/core/types/cms'

type ArchiveBlockProps = Extract<Page['layout'][0], { blockType: 'archive' }>

interface RequestWithRevealUI extends RevealRequest {
  revealui?: RevealUIInstance
}

interface PopulateContext {
  isPopulatingArchiveBlock?: boolean
  [key: string]: unknown
}

export const populateArchiveBlock: RevealAfterReadHook = async ({
  doc,
  context,
  req,
}) => {
  const revealui = req?.revealui
  const docWithLayout = doc as unknown as {
    layout?: Array<{ blockType: string; [key: string]: unknown }>
  }

  if (!(docWithLayout.layout && revealui)) return doc as RevealDocument

  const layout = docWithLayout.layout

  const layoutWithArchive = await Promise.allSettled(
    layout.map(async (block) => {
      if (block.blockType === 'archive') {
        const archiveBlock = block as unknown as ArchiveBlockProps & {
          populatedDocs: Array<{
            relationTo: 'products' | 'pages' | 'posts' | 'categories'
            value: string
          }>
        }

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
          })

          return {
            ...block,
            populatedDocsTotal: res.totalDocs,
            populatedDocs: res.docs.map((thisDoc) => ({
              relationTo: archiveBlock.relationTo,
              value: String(thisDoc.id),
            })),
          }
        }
      }

      return block
    }),
  )

  // Extract fulfilled values from the settled promises
  const resolvedLayout = layoutWithArchive
    .map((result) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      // For rejected promises, return the original block
      return null
    })
    .filter(Boolean)

  return { ...doc, layout: resolvedLayout } as RevealDocument
}
