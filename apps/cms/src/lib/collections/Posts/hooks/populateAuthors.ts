import type { CollectionAfterReadHook, RevealDocument, RevealUIInstance } from '@revealui/core'
import type { User } from '@revealui/core/types/cms'

interface PostWithAuthors extends RevealDocument {
  authors?: Array<string | { id: string }>
  populatedAuthors?: Array<{ id: string; name: string | null | undefined }>
}

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the authors manually here to protect user privacy
// So we use an alternative `populatedAuthors` field to populate the user data, hidden from the admin UI
export const populateAuthors: CollectionAfterReadHook = async ({ doc, req }) => {
  if (!req.revealui) {
    return doc
  }

  const postDoc = doc as PostWithAuthors
  const authors = postDoc.authors
  const revealui = req.revealui as RevealUIInstance

  if (authors && Array.isArray(authors)) {
    const authorDocs: User[] = []

    for (const author of authors) {
      const authorId = typeof author === 'object' && author !== null ? author.id : author
      if (!authorId) {
        continue
      }

      try {
        const authorDoc = await revealui.findByID({
          id: authorId,
          collection: 'users',
          depth: 0,
          req,
        })

        if (authorDoc) {
          authorDocs.push(authorDoc as User)
        }
      } catch {
        // Skip authors that can't be found
      }
    }

    postDoc.populatedAuthors = authorDocs.map((authorDoc) => ({
      id: authorDoc.id,
      name: authorDoc.firstName,
    }))
  }

  return postDoc as RevealDocument
}
