import { AdminDashboard } from '@revealui/core/admin';
import { serializeConfig } from '@revealui/core/admin/utils/serializeConfig';
import type { RevealConfig } from '@revealui/core/types/core';
import { IconSettings } from '@revealui/presentation/server';
import Link from 'next/link';
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
    <div className="relative">
      <Link
        href="/settings"
        className="absolute right-28 top-5 z-10 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Settings"
      >
        <IconSettings className="h-5 w-5" aria-hidden="true" />
      </Link>
      <AdminDashboard
        config={serializedConfig}
        siteName={siteName}
        overviewLead={<HomeOnboarding />}
      />
    </div>
  );
}
