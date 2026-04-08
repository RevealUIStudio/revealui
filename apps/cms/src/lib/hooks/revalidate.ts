import config from '@revealui/config';
import type { RevealUIInstance } from '@revealui/core';

export const revalidate = async (args: {
  collection: string;
  slug: string;
  revealui: RevealUIInstance;
}): Promise<void> => {
  const { collection, slug, revealui } = args;

  try {
    const url = `${config.reveal.publicServerURL}/api/revalidate`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': config.reveal.secret,
      },
      body: JSON.stringify({ collection, slug }),
    });

    if (res.ok) {
      revealui.logger.info(`Successfully revalidated page '${slug}' in collection '${collection}'`);
    } else {
      const errorText = await res.text();
      revealui.logger.error(
        `Error revalidating page '${slug}' in collection '${collection}': ${res.status} - ${errorText}`,
      );
    }
  } catch (err: unknown) {
    revealui.logger.error(
      `Error hitting revalidate route for page '${slug}' in collection '${collection}': ${(err as Error).message}`,
    );
  }
};
