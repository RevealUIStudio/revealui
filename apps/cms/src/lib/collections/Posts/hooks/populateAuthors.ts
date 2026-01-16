import type { CollectionAfterReadHook } from '@revealui/core'
import type { User } from '@revealui/types/cms'

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the authors manually here to protect user privacy
// So we use an alternative `populatedAuthors` field to populate the user data, hidden from the admin UI
export const populateAuthors: CollectionAfterReadHook = async ({ doc, req }) => {
  const revealui = (req as any)?.revealui
  const authors = (doc as any)?.authors as Array<string | { id: string }> | undefined

  if (authors && revealui) {
    const authorDocs: User[] = []

    for (const author of authors) {
      const authorDoc = await (revealui as any).findByID({
        id: typeof author === 'object' ? author?.id : author,
        collection: 'users',
        depth: 0,
        req,
      })

      authorDocs.push(authorDoc)
    }

    ;(doc as any).populatedAuthors = authorDocs.map((authorDoc) => ({
      id: authorDoc.id,
      name: authorDoc.firstName,
    }))
  }

  return doc
}
