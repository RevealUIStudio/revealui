import { AdminDashboard } from '@revealui/core/admin'
import { serializeConfig } from '@revealui/core/admin/utils/serializeConfig'
import type { RevealConfig } from '@revealui/core/types/core'
import config from '../../../../../revealui.config'

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
export default async function Page({ params: _params, searchParams: _searchParams }: Args) {
  // Serialize config to remove functions before passing to client component
  const serializedConfig = serializeConfig(config as RevealConfig)

  // Use the AdminDashboard component which provides full CRUD operations
  return <AdminDashboard config={serializedConfig} />
}
