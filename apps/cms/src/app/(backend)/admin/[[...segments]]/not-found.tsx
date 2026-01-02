/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
import type { Metadata } from "next";

import config from "@reveal-config";
/* RevealUI Admin Not Found - Local implementation */
import { NotFoundPage, generatePageMetadata } from "@revealui/cms/admin";
import { importMap } from "../importMap";

type Args = {
  params: {
    segments: string[];
  };
  searchParams: {
    [key: string]: string | string[];
  };
};

export const generateMetadata = async ({
  params,
  searchParams,
}: Args): Promise<Metadata> => {
  // Ensure params and searchParams are Promises
  const resolvedParams = Promise.resolve(params);
  const resolvedSearchParams = Promise.resolve(searchParams);

  return generatePageMetadata({
    config: config as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    params: resolvedParams,
    searchParams: resolvedSearchParams,
  });
};

const NotFound = async ({ params, searchParams }: Args) => {
  // Ensure params and searchParams are Promises
  const resolvedParams = Promise.resolve(params);
  const resolvedSearchParams = Promise.resolve(searchParams);

  return NotFoundPage({
    importMap,
    config: config as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    params: resolvedParams,
    searchParams: resolvedSearchParams,
  });
};

export default NotFound;

// /* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
// import type { Metadata } from "next";

// import config from "@reveal-config";
// /* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
// // TODO: Implement local alternative
// import // @payloadcms/next/views";
// import { importMap } from "../importMap";
// type Args = {
//   params: {
//     segments: string[];
//   };
//   searchParams: {
//     [key: string]: string | string[];
//   };
// };

// export const generateMetadata = ({
//   params,
//   searchParams,
// }: Args): Promise<Metadata> =>
//   generatePageMetadata({ config, params, searchParams });

// const NotFound = ({ params, searchParams }: Args) =>
//   NotFoundPage({ importMap, config, params, searchParams });

// export default NotFound;
