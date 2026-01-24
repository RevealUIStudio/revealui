import type {
  RevealDocument,
  RevealRequest,
  RevealUIFieldHook,
  RevealUIInstance,
  RevealValue,
} from '@revealui/core'

interface RequestWithRevealUI extends RevealRequest {
  revealui?: RevealUIInstance & {
    collections?: {
      users?: {
        config?: {
          hooks?: {
            beforeChange?: Array<RevealUIFieldHook>
          }
        }
      }
    }
  }
}

interface DocWithPublishedAt extends RevealDocument {
  // biome-ignore lint/style/useNamingConvention: matches stored field name
  PublishedAt?: RevealValue
}

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the PublishedAt manually here to protect user privacy
// So we use an alternative `populatedPublishedAt` field to populate the user data, hidden from the admin UI
export async function populatePublishedAt({
  data,
  originalDoc,
  req,
}: {
  data?: Record<string, unknown>
  originalDoc?: DocWithPublishedAt
  req?: RequestWithRevealUI
}): Promise<Record<string, unknown> | undefined> {
  const revealui = req?.revealui

  if (originalDoc?.PublishedAt && revealui?.collections?.users?.config?.hooks?.beforeChange?.[0]) {
    const hook = revealui.collections.users.config.hooks.beforeChange[0]
    const user = await hook({
      value: originalDoc.PublishedAt,
      originalDoc: originalDoc.PublishedAt as RevealDocument,
      operation: 'create',
      data: {},
      siblingData: {},
      req,
    })

    return {
      ...data,
      populatedPublishedAt: user,
    }
  }

  return data
}
