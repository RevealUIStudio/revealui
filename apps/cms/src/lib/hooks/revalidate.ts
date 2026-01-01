import type { Payload } from "@revealui/cms";

export const revalidate = async (args: {
  collection: string;
  slug: string;
  payload: Payload;
}): Promise<void> => {
  const { collection, slug, payload } = args;

  try {
    const url = `${process.env.PAYLOAD_PUBLIC_SERVER_URL}/api/revalidate?secret=${process.env.PAYLOAD_REVALIDATION_KEY}&collection=${collection}&slug=${slug}`;

    const res = await fetch(url);

    if (res.ok) {
      payload.logger.info(
        `Successfully revalidated page '${slug}' in collection '${collection}'`,
      );
    } else {
      const errorText = await res.text();
      payload.logger.error(
        `Error revalidating page '${slug}' in collection '${collection}': ${res.status} - ${errorText}`,
      );
    }
  } catch (err: unknown) {
    payload.logger.error(
      `Error hitting revalidate route for page '${slug}' in collection '${collection}': ${(err as Error).message}`,
    );
  }
};

// import type { Payload } from "@revealui/cms";

// export const revalidate = async (args: {
//   collection: string;
//   slug: string;
//   payload: Payload;
// }): Promise<void> => {
//   const { collection, slug, payload } = args;

//   try {
//     const res = await fetch(
//       `${process.env.PAYLOAD_PUBLIC_SERVER_URL}/api/revalidate?secret=${process.env.PAYLOAD_REVALIDATION_KEY}&collection=${collection}&slug=${slug}`,
//     );

//     if (res.ok) {
//       payload.logger.info(
//         `Revalidated page '${slug}' in collection '${collection}'`,
//       );
//     } else {
//       payload.logger.error(
//         `Error revalidating page '${slug}' in collection '${collection}': ${res}`,
//       );
//     }
//   } catch (err: unknown) {
//     payload.logger.error(
//       `Error hitting revalidate route for page '${slug}' in collection '${collection}': ${err}`,
//     );
//   }
// };
