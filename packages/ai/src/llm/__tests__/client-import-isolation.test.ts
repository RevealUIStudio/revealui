import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Store smoke (Apify 0.1.8): a static `import { SemanticCache }` from
 * `./semantic-cache.js` evaluates VectorMemoryService → `@revealui/db/client`
 * → `@revealui/config`, which throws REVEALUI_PUBLIC_SERVER_URL in production.
 * BYOK construction must keep SemanticCache as a type-only + dynamic import.
 */
describe('LLMClient import isolation', () => {
  const clientSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../client.ts'),
    'utf8',
  );

  it('does not statically import the SemanticCache value', () => {
    expect(clientSrc).not.toMatch(
      /import\s*\{[^}]*\bSemanticCache\b[^}]*\}\s*from\s*['"]\.\/semantic-cache/,
    );
    expect(clientSrc).toMatch(/import type\s*\{[^}]*SemanticCache/);
    expect(clientSrc).toMatch(/import\(['"]\.\/semantic-cache\.js['"]\)/);
  });
});
