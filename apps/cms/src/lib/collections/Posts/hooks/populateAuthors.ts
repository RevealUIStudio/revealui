import type { RevealAfterReadHook, RevealDocument, RevealUIInstance } from '@revealui/core'
import type { User } from '@revealui/core/types/cms'

interface PostWithAuthors extends RevealDocument {}

type PostWithPopulated = PostWithAuthors & {
  populatedAuthors?: Array<{ id: string | number; name: string | null | undefined }>
}

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the authors manually here to protect user privacy
// So we use an alternative `populatedAuthors` field to populate the user data, hidden from the admin UI
export const populateAuthors: RevealAfterReadHook = async ({ doc, req }) => {
  if (!req.revealui) {
    return doc
  }

  const postDoc = doc as PostWithPopulated
  const authors = postDoc.authors
  const revealui = req.revealui as RevealUIInstance

  if (authors && Array.isArray(authors)) {
    const authorDocs: User[] = []

    for (const author of authors) {
      const authorId =
        typeof author === 'object' && author !== null
          ? (author as { id?: string | number }).id
          : author
      if (!authorId || typeof authorId === 'boolean') {
        continue
      }

      try {
        const authorDoc = await revealui.findByID({
          id: authorId as string | number,
          collection: 'users',
          depth: 0,
          // RevealUI CMS API type compatibility - req types don't exactly match but are runtime-compatible
          req: req as unknown as Parameters<typeof revealui.findByID>[0]['req'],
        })

        if (authorDoc) {
          authorDocs.push(authorDoc as unknown as User)
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
