/**
 * Durable ACP / headless-agent resolve path for @revealui/ai.
 *
 * Root cause fixed by optionalDependency (same posture as @revealui/cli):
 * without a package graph edge, monorepo `revealui-harnesses acp` cannot
 * dynamic-import the agent runtime. Do not replace this with NODE_PATH or
 * hand symlinks.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '../../package.json');

describe('@revealui/ai optionalDependency (ACP headless runtime)', () => {
  it('declares @revealui/ai as an optionalDependency', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      optionalDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    expect(pkg.optionalDependencies?.['@revealui/ai']).toMatch(/workspace/);
    // Keep the hard-require boundary: not a required dependency.
    expect(pkg.dependencies?.['@revealui/ai']).toBeUndefined();
  });

  it('resolves the subpaths the headless adapter dynamic-imports', async () => {
    const [runtime, client, tools] = await Promise.all([
      import('@revealui/ai/orchestration/streaming-runtime'),
      import('@revealui/ai/llm/client'),
      import('@revealui/ai/tools/coding'),
    ]);
    expect(typeof runtime.StreamingAgentRuntime).toBe('function');
    expect(typeof client.createLLMClientFromEnv).toBe('function');
    expect(typeof tools.createCodingTools).toBe('function');
  });
});
