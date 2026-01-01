import type { GlobalAfterChangeHook } from "revealui/cms";

import { revalidateTag } from "next/cache";

export const revalidateFooter: GlobalAfterChangeHook = ({
  doc,
  req: { payload },
}) => {
  payload.logger.info(`Revalidating footer`);

  revalidateTag("global_footer", "page");

  return doc;
};
