/**
 * Provider catalog for the Settings, API Keys page (GAP-360 §5.7).
 *
 * Mirrors the seven providers @revealui/ai's `LLMProviderType` supports
 * (`packages/ai/src/llm/client.ts:49`). Kept as a local string union rather
 * than importing that type: `@revealui/ai` is an optional Pro peer
 * dependency for `apps/admin` (`package.json:67`) and every existing
 * consumer only ever value-imports it dynamically with a `.catch(() =>
 * null)` fallback (see `src/lib/ai/pro-stub.ts`) — this keeps the same
 * contract for the display metadata below.
 */

export type Provider =
  | 'anthropic'
  | 'openai'
  | 'groq'
  | 'huggingface'
  | 'ollama'
  | 'inference-snaps'
  | 'xai';

/** GAP-483 dated map. Remap here when a release moves the band. */
export type CapabilityClass = 'local' | 'mechanical' | 'frontier' | 'reasoning';

export const CAPABILITY_CLASS_ORDER: readonly CapabilityClass[] = [
  'local',
  'mechanical',
  'frontier',
  'reasoning',
];

export interface ProviderInfo {
  id: Provider;
  label: string;
  placeholder: string;
  docsUrl: string;
  /** Capability class (2026-08-15 map). Not a vendor name. */
  capability: CapabilityClass;
}

/** All seven providers, hosted-viable and localhost-only alike. */
export const ALL_PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    capability: 'frontier',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    capability: 'frontier',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    placeholder: 'xai-...',
    docsUrl: 'https://console.x.ai',
    capability: 'frontier',
  },
  {
    id: 'groq',
    label: 'Groq',
    placeholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    capability: 'mechanical',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    placeholder: 'hf_...',
    docsUrl: 'https://huggingface.co/settings/tokens',
    capability: 'mechanical',
  },
  {
    id: 'inference-snaps',
    label: 'Inference Snaps',
    placeholder: 'leave blank, runs locally',
    docsUrl: 'https://snapcraft.io/search?q=inference',
    capability: 'local',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    placeholder: 'leave blank, runs locally',
    docsUrl: 'https://ollama.com/docs',
    capability: 'local',
  },
];

export function formatAdapterLabel(provider: ProviderInfo): string {
  return `${provider.capability} · ${provider.label}`;
}

/**
 * Resolve which providers the Settings, API Keys page should offer.
 *
 * Self-hosted: all seven. Hosted: only the ones `@revealui/ai`'s
 * `hostedViable` map marks reachable from a serverless deployment
 * (anthropic/openai/groq/huggingface/xai) — `ollama`/`inference-snaps` are
 * localhost-only and useless on hosted (GAP-360 defect 5). When the hosted
 * map can't be resolved (Pro package absent), fail open to the full list —
 * this only affects what the page DISPLAYS; execution-time provider choice
 * is enforced independently by the resolver (GAP-360 PR-2).
 */
export function visibleProviders(
  isHosted: boolean,
  hostedViable: Record<Provider, boolean> | null,
): ProviderInfo[] {
  if (!(isHosted && hostedViable)) return ALL_PROVIDERS;
  return ALL_PROVIDERS.filter((provider) => hostedViable[provider.id]);
}
