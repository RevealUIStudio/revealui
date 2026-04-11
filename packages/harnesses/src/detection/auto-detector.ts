import { RevealUIAgentAdapter } from '../adapters/revealui-agent-adapter.js';
import type { HarnessRegistry } from '../registry/harness-registry.js';

/**
 * Detects available AI harnesses and registers them in the registry.
 *
 * Creates an adapter for each known harness, checks isAvailable(),
 * and registers those that respond. Unavailable adapters are disposed.
 */
export async function autoDetectHarnesses(registry: HarnessRegistry): Promise<string[]> {
  const candidates = [new RevealUIAgentAdapter()];

  const registered: string[] = [];

  await Promise.all(
    candidates.map(async (adapter) => {
      try {
        if (await adapter.isAvailable()) {
          registry.register(adapter);
          registered.push(adapter.id);
        } else {
          await adapter.dispose();
        }
      } catch {
        await adapter.dispose();
      }
    }),
  );

  return registered;
}
