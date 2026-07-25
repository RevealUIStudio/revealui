/**
 * Settings, API Keys — server shell.
 *
 * Resolves the GAP-360 hosted flag server-side via detectDeploymentMode
 * (GAP-260 P4-1: REVEALUI_DEPLOYMENT_MODE, fallback private-key presence)
 * and the provider list to offer, then hands both down to the client page.
 * The boolean crosses the server/client boundary; the env var itself never
 * does.
 */

import { isHostedDeployment } from '@revealui/core/deployment-mode';
import { visibleProviders } from '@/lib/settings/api-key-providers';
import ApiKeysPageClient from './api-keys-client';

export default async function ApiKeysPage() {
  const isHosted = isHostedDeployment(process.env);

  // @revealui/ai is an optional Pro peer dependency of apps/admin — dynamic
  // import + catch, matching every other consumer (src/lib/ai/pro-stub.ts).
  const aiClientMod = await import('@revealui/ai/llm/client').catch(() => null);
  const hostedViable = aiClientMod?.hostedViable ?? null;

  const providers = visibleProviders(isHosted, hostedViable);

  return <ApiKeysPageClient providers={providers} isHosted={isHosted} />;
}
