import { revalidateTag } from 'next/cache';

type RevalidateFooterArgs = {
  doc: unknown;
  req: {
    revealui?: {
      logger?: {
        info?: (message: string) => void;
      };
    };
  };
};

export const revalidateFooter = ({ doc, req }: RevalidateFooterArgs) => {
  const revealui = req.revealui;
  revealui?.logger?.info?.(`Revalidating footer`);

  revalidateTag('global_footer', 'page');

  return doc;
};
