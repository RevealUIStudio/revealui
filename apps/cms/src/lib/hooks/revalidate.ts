import type { RevealUIInstance } from "@revealui/cms";

export const revalidate = async (args: {
  collection: string;
  slug: string;
  revealui: RevealUIInstance;
}): Promise<void> => {
  const { collection, slug, revealui } = args;

  try {
    const url = `${process.env.REVEALUI_PUBLIC_SERVER_URL}/api/revalidate?secret=${process.env.REVEALUI_SECRET}&collection=${collection}&slug=${slug}`;

    const res = await fetch(url);

    if (res.ok) {
      revealui.logger.info(
        `Successfully revalidated page '${slug}' in collection '${collection}'`,
      );
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
