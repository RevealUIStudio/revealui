/**
 * Free local chat default is loaded from the allowlist, not copied here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('agent local default', () => {
  it('resolves the daily ollama model from the allowlist subpath', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'agent.ts'), 'utf8');
    expect(source).toContain('@revealui/ai/llm/providers/us-origin-snaps');
    expect(source).toContain('resolveApprovedLocalModel');
    expect(source.includes("provider: 'ollama', model: '")).toBe(false);
  });
});
