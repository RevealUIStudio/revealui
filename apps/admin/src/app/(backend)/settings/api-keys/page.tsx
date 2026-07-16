/**
 * Settings, API Keys — server shell.
 *
 * Resolves the GAP-360 hosted flag server-side (same signal as
 * `app/api/chat/route.ts:315` — `REVEALUI_LICENSE_PRIVATE_KEY` presence)
 * and the provider list to offer, then hands both down to the client page.
 * The boolean crosses the server/client boundary; the env var itself never
 * does.
 */

import { visibleProviders } from '@/lib/settings/api-key-providers';
import ApiKeysPageClient from './api-keys-client';

export default async function ApiKeysPage() {
  const isHosted = !!process.env.REVEALUI_LICENSE_PRIVATE_KEY;

  // @revealui/ai is an optional Pro peer dependency of apps/admin — dynamic
  // import + catch, matching every other consumer (src/lib/ai/pro-stub.ts).
  const aiClientMod = await import('@revealui/ai/llm/client').catch(() => null);
  const hostedViable = aiClientMod?.hostedViable ?? null;

  const providers = visibleProviders(isHosted, hostedViable);

  return <ApiKeysPageClient providers={providers} isHosted={isHosted} />;
}
