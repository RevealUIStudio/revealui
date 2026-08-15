import { describe, expect, it } from 'vitest';
import type { Provider } from '../api-key-providers';
import { ALL_PROVIDERS, formatAdapterLabel, visibleProviders } from '../api-key-providers';

/**
 * Loads the real `hostedViable` map from `@revealui/ai/llm/client` so this
 * suite proves alignment with PR-1's classification rather than a
 * hand-copied duplicate. A dynamic import, not a static one: apps/admin
 * treats @revealui/ai as an optional Pro peer dependency everywhere,
 * including test files (`scripts/validate/boundary.ts` Check 4 enforces
 * this — a static import here would hard-require the Pro package).
 */
async function loadHostedViable(): Promise<Record<Provider, boolean>> {
  const mod = await import('@revealui/ai/llm/client');
  return mod.hostedViable;
}

describe('visibleProviders', () => {
  it('offers all seven providers on self-hosted, regardless of the hosted map', async () => {
    const hostedViable = await loadHostedViable();
    expect(visibleProviders(false, hostedViable).map((p) => p.id)).toEqual(
      ALL_PROVIDERS.map((p) => p.id),
    );
    expect(visibleProviders(false, null).map((p) => p.id)).toEqual(ALL_PROVIDERS.map((p) => p.id));
  });

  it('hides localhost-only providers on hosted (GAP-360 defect 5)', async () => {
    const hostedViable = await loadHostedViable();
    const ids = visibleProviders(true, hostedViable).map((p) => p.id);
    expect(ids).toEqual(['anthropic', 'openai', 'xai', 'groq', 'huggingface']);
    expect(ids).not.toContain('ollama');
    expect(ids).not.toContain('inference-snaps');
  });

  it('maps adapters onto capability classes (GAP-483 2026-08-15)', () => {
    expect(ALL_PROVIDERS.find((p) => p.id === 'groq')?.capability).toBe('mechanical');
    expect(ALL_PROVIDERS.find((p) => p.id === 'xai')?.capability).toBe('frontier');
    expect(ALL_PROVIDERS.find((p) => p.id === 'ollama')?.capability).toBe('local');
    expect(formatAdapterLabel(ALL_PROVIDERS.find((p) => p.id === 'groq')!)).toBe(
      'mechanical · Groq',
    );
  });

  it('fails open to the full list on hosted when the hosted map is unavailable', () => {
    // e.g. @revealui/ai absent (Pro package stripped) — a display-only
    // fallback; execution-time enforcement lives in the resolver, not here.
    expect(visibleProviders(true, null).map((p) => p.id)).toEqual(ALL_PROVIDERS.map((p) => p.id));
  });
});
