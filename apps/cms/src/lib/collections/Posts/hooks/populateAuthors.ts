import type { RevealAfterReadHook, RevealDocument, RevealUIInstance } from '@revealui/core';
import type { User } from '@revealui/core/types/cms';
import { asDocument } from '@/lib/utils/type-guards';

interface PostWithAuthors extends RevealDocument {}

type PostWithPopulated = PostWithAuthors & {
  populatedAuthors?: Array<{ id: string | number; name: string | null | undefined }>;
};

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the authors manually here to protect user privacy
// So we use an alternative `populatedAuthors` field to populate the user data, hidden from the admin UI
export const populateAuthors: RevealAfterReadHook = async ({ doc, req }) => {
  if (!req.revealui) {
    return doc;
  }

  const postDoc = doc as PostWithPopulated;
  const authors = postDoc.authors;
  const revealui = req.revealui as RevealUIInstance;

  if (authors && Array.isArray(authors)) {
    // Extract all author IDs first, then batch-load in a single query
    const authorIds: (string | number)[] = [];
    for (const author of authors) {
      const authorId =
        typeof author === 'object' && author !== null
          ? (author as { id?: string | number }).id
          : author;
      if (authorId && typeof authorId !== 'boolean') {
        authorIds.push(authorId);
      }
    }

    if (authorIds.length > 0) {
      // Single batch query instead of N individual findByID calls
      const authorDocs: User[] = [];
      try {
        const results = await revealui.find({
          collection: 'users',
          where: { id: { in: authorIds.map(String) } },
          depth: 0,
          limit: authorIds.length,
          req: req as unknown as Parameters<typeof revealui.find>[0]['req'],
        });
        if (results?.docs) {
          for (const doc of results.docs) {
            authorDocs.push(asDocument<User>(doc));
          }
        }
      } catch {
        // Skip if batch lookup fails
      }

      postDoc.populatedAuthors = authorDocs.map((authorDoc) => ({
        id: authorDoc.id,
        name: authorDoc.firstName,
      }));
    }
  }

  return postDoc as RevealDocument;
};
