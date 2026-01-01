import type { RevealAfterChangeHook, RevealDocument, RevealHookContext } from "@revealui/cms";

import { revalidateTag } from "next/cache";

export const revalidateRedirects: RevealAfterChangeHook = ({
  doc,
  context,
}: {
  doc: RevealDocument;
  context: RevealHookContext;
}) => {
  context.payload.logger.info(`Revalidating redirects after ${context.operation} operation`);

  revalidateTag("redirects", "page");

  return doc;
};
