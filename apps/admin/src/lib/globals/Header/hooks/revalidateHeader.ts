import { getCacheLogger, revalidateTag } from '@revealui/cache';

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

  void revalidateTag('global_header').catch((error: unknown) => {
    getCacheLogger().error('revalidateHeader: revalidateTag failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return doc;
};
