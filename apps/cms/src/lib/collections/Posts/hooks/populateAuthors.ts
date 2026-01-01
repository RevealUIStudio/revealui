import { User } from "@/types";
import type { CollectionAfterReadHook } from "@revealui/cms";

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the authors manually here to protect user privacy
// So we use an alternative `populatedAuthors` field to populate the user data, hidden from the admin UI
export const populateAuthors: CollectionAfterReadHook = async ({
  doc,
  req,
  req: { payload },
}) => {
  if (doc?.authors) {
    const authorDocs: User[] = [];

    for (const author of doc.authors) {
      const authorDoc = await payload.findByID({
        id: typeof author === "object" ? author?.id : author,
        collection: "users",
        depth: 0,
        req,
      });

      authorDocs.push(authorDoc);
    }

    doc.populatedAuthors = authorDocs.map((authorDoc) => ({
      id: authorDoc.id,
      name: authorDoc.firstName,
    }));
  }

  return doc;
};
