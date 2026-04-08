import type {
  RevealBeforeChangeHook,
  RevealDocument,
  RevealRequest,
  RevealUIFieldHook,
  RevealUIInstance,
  RevealValue,
} from '@revealui/core';

interface RequestWithRevealUI extends RevealRequest {
  revealui?: RevealUIInstance & {
    collections?: {
      users?: {
        config?: {
          hooks?: {
            beforeChange?: Array<RevealUIFieldHook>;
          };
        };
      };
    };
  };
}

interface DocWithPublishedAt extends RevealDocument {
  PublishedAt?: RevealValue;
}

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the PublishedAt manually here to protect user privacy
// So we use an alternative `populatedPublishedAt` field to populate the user data, hidden from the admin UI
// biome-ignore lint/suspicious/noExplicitAny: Hook works with any document type
export const populatePublishedAt: RevealBeforeChangeHook<any> = async ({
  data,
  originalDoc,
  req,
}) => {
  const revealui = (req as RequestWithRevealUI | undefined)?.revealui;

  if (originalDoc?.PublishedAt && revealui?.collections?.users?.config?.hooks?.beforeChange?.[0]) {
    const hook = revealui.collections.users.config.hooks.beforeChange[0];
    const user = await hook({
      value: originalDoc.PublishedAt,
      originalDoc: originalDoc.PublishedAt as RevealDocument,
      operation: 'create',
      data: {},
      siblingData: {},
      req,
    });

    return {
      ...data,
      populatedPublishedAt: user,
    } as DocWithPublishedAt;
  }

  return data;
};
