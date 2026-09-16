import { AdminDashboard } from '@revealui/core/admin';
import { serializeConfig } from '@revealui/core/admin/utils/serializeConfig';
import type { RevealConfig } from '@revealui/core/types/core';
import HomeOnboarding from '@/lib/components/BeforeDashboard/HomeOnboarding';
import config from '../../../../revealui.config';

// Static route for /dashboard — wins over (frontend)/[slug] dynamic route.
// (frontend)/[slug] has higher Next.js routing priority than the
// (backend)/[[...segments]] catch-all for single-segment paths, so
// /dashboard was incorrectly intercepted by the CMS catch-all and threw
// when the admin engine wasn't ready. A static segment always beats a
// dynamic segment regardless of route group, so this file takes /dashboard
// before [slug] is considered.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const serializedConfig = serializeConfig(config as RevealConfig);
  // White-label: resolve server-side; client files can't read these env vars
  // at runtime (build-time inlining). `||` not `??`: unset vars arrive as ''.
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
