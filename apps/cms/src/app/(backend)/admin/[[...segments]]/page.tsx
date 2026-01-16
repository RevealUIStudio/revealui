import config from '@revealui/config'
import { AdminDashboard } from '@revealui/core/admin'
import { serializeConfig } from '@revealui/core/admin/utils/serializeConfig'
import type { RevealConfig } from '@revealui/core/types/core'

// Force dynamic rendering to prevent build-time initialization
export const dynamic = 'force-dynamic'
export const dynamicParams = true

type Args = {
  params: Promise<{
    segments?: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

// Admin page using the full AdminDashboard component with CRUD functionality
export default async function Page({ params, searchParams }: Args) {
  // Serialize config to remove functions before passing to client component
  const serializedConfig = serializeConfig(config as RevealConfig)

  // Use the AdminDashboard component which provides full CRUD operations
  return <AdminDashboard config={serializedConfig} />
}

// /* RevealUI Admin Page - Legacy */
// import config from "@reveal-config";
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

// const Page = ({ params, searchParams }: Args) =>
//   RootPage({ config, params, searchParams, importMap });

// export default Page;
