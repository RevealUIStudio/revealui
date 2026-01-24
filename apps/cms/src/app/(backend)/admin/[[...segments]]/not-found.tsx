/* RevealUI Admin Not Found Page */

import config from '@revealui/config'
/* RevealUI Admin Not Found - Local implementation */
import { generatePageMetadata, NotFoundPage } from '@revealui/core/admin'
import type { Metadata } from 'next'
import { importMap } from '../importMap'

type Args = {
  params: {
    segments: string[]
  }
  searchParams: {
    [key: string]: string | string[]
  }
}

type AdminConfig = {
  collections?: unknown[]
  globals?: unknown[]
  [key: string]: unknown
}

const adminConfig = config as AdminConfig

export const generateMetadata = async ({ params, searchParams }: Args): Promise<Metadata> => {
  // Ensure params and searchParams are Promises
  const resolvedParams = Promise.resolve(params)
  const resolvedSearchParams = Promise.resolve(searchParams)

  return generatePageMetadata({
    config: adminConfig,
    params: resolvedParams,
    searchParams: resolvedSearchParams,
  })
}

const NotFound = async ({ params, searchParams }: Args) => {
  // Ensure params and searchParams are Promises
  const resolvedParams = Promise.resolve(params)
  const resolvedSearchParams = Promise.resolve(searchParams)

  return NotFoundPage({
    importMap,
    config: adminConfig,
    params: resolvedParams,
    searchParams: resolvedSearchParams,
  })
}

export default NotFound

// /* RevealUI Admin Not Found Page */
// import type { Metadata } from "next";

// import config from "@revealui/config";
// /* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
// // TODO: Implement local alternative
// import // @revealui/core";
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
