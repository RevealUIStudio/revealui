/**
 * Daily Ollama tag is the allowlist export, not a copied literal.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveDailyOllamaModel } from '../server/inference-service.js';

describe('resolveDailyOllamaModel', () => {
  it('returns the allowlist default', async () => {
    const allowlist = await import('@revealui/ai/llm/providers/us-origin-snaps');
    expect(await resolveDailyOllamaModel()).toBe(allowlist.DEFAULT_DAILY_OLLAMA_MODEL);
  });

  it('loads that default through the allowlist subpath', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '../server/inference-service.ts'), 'utf8');
    expect(source).toContain('@revealui/ai/llm/providers/us-origin-snaps');
    expect(source).toContain('resolveApprovedLocalModel');
    expect(source.includes('const DEFAULT_DAILY_OLLAMA')).toBe(false);
  });
});
