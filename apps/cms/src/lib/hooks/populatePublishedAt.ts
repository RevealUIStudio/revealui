/* eslint-disable @typescript-eslint/no-explicit-any */

import { Content } from "../blocks/Content/config";

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the PublishedAt manually here to protect user privacy
// So we use an alternative `populatedPublishedAt` field to populate the user data, hidden from the admin UI
export const populatePublishedAt = async ({
  originalDoc,
  req: { payload },
}: {
  originalDoc?: any;
  req: { payload: any };
}) => {
  if (originalDoc?.PublishedAt) {
    const user =
      await payload?.collections.users?.config?.hooks?.beforeChange?.[0]?.({
        data: originalDoc.PublishedAt,
        originalDoc: originalDoc.PublishedAt,
        context: Content,
        operation: "create",
        collection: undefined,
        req: undefined,
      });

    return {
      ...originalDoc,
      populatedPublishedAt: user,
    };
  }
};
