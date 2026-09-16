import { AdminDashboard } from '@revealui/core/admin';
import { serializeConfig } from '@revealui/core/admin/utils/serializeConfig';
import type { RevealConfig } from '@revealui/core/types/core';
import HomeOnboarding from '@/lib/components/BeforeDashboard/HomeOnboarding';
import config from '../../../../revealui.config';

// Force dynamic rendering to prevent build-time initialization
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Args = {
  params: Promise<{
    segments?: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

// Admin page using the full AdminDashboard component with CRUD functionality
export default async function Page({ params: _params, searchParams: _searchParams }: Args) {
  // Serialize config to remove functions before passing to client component
  const serializedConfig = serializeConfig(config as RevealConfig);
  // White-label: resolve the brand server-side and pass down; client files
  // can't read these env vars at runtime (build-time inlining). `||` not
  // `??`: Compose `${VAR:-}` delivers unset vars as empty strings.
  const siteName =
    process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';

  return (
    <AdminDashboard
      config={serializedConfig}
      siteName={siteName}
      overviewLead={<HomeOnboarding />}
    />
  );
}
