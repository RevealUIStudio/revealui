import { getCacheLogger, revalidateTag } from '@revealui/cache';

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

  void revalidateTag('global_footer').catch((error: unknown) => {
    getCacheLogger().error('revalidateFooter: revalidateTag failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return doc;
};
