import { hostedViable } from '@revealui/ai/llm/client';
import { describe, expect, it } from 'vitest';
import { ALL_PROVIDERS, visibleProviders } from '../api-key-providers';

describe('visibleProviders', () => {
  it('offers all six providers on self-hosted, regardless of the hosted map', () => {
    expect(visibleProviders(false, hostedViable).map((p) => p.id)).toEqual(
      ALL_PROVIDERS.map((p) => p.id),
    );
    expect(visibleProviders(false, null).map((p) => p.id)).toEqual(ALL_PROVIDERS.map((p) => p.id));
  });

  it('hides localhost-only providers on hosted (GAP-360 defect 5)', () => {
    const ids = visibleProviders(true, hostedViable).map((p) => p.id);
    expect(ids).toEqual(['anthropic', 'openai', 'groq', 'huggingface']);
    expect(ids).not.toContain('ollama');
    expect(ids).not.toContain('inference-snaps');
  });

  it('fails open to the full list on hosted when the hosted map is unavailable', () => {
    // e.g. @revealui/ai absent (Pro package stripped) — a display-only
    // fallback; execution-time enforcement lives in the resolver, not here.
    expect(visibleProviders(true, null).map((p) => p.id)).toEqual(ALL_PROVIDERS.map((p) => p.id));
  });
});
