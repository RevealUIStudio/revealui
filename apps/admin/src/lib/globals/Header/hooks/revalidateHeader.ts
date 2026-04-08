import { revalidateTag } from 'next/cache';

type RevalidateHeaderArgs = {
  doc: unknown;
  req: {
    revealui?: {
      logger?: {
        info?: (message: string) => void;
      };
    };
  };
};

export const revalidateHeader = ({ doc, req }: RevalidateHeaderArgs) => {
  const revealui = req.revealui;
  revealui?.logger?.info?.(`Revalidating header`);

  revalidateTag('global_header', 'page');

  return doc;
};
