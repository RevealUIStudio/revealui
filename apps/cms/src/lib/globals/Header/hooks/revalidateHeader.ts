import type { GlobalAfterChangeHook } from '@revealui/cms'

import { revalidateTag } from 'next/cache'

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req: { payload } }) => {
  payload?.logger?.info(`Revalidating header`)

  revalidateTag('global_header', 'page')

  return doc
}
