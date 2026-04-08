import type { HarnessAdapter } from '../types/adapter.js';

/**
 * Manages the lifecycle of HarnessAdapter instances.
 * Mirrors EditorRegistry from packages/editors.
 */
export class HarnessRegistry {
  private readonly adapters = new Map<string, HarnessAdapter>();

  /** Register an adapter. Throws if an adapter with the same id already exists. */
  register(adapter: HarnessAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Harness adapter already registered: ${adapter.id}`);
    }
    this.adapters.set(adapter.id, adapter);
    adapter.notifyRegistered?.();
  }

  /** Unregister an adapter, disposing it in the process. */
  async unregister(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (adapter) {
      adapter.notifyUnregistering?.();
      await adapter.dispose();
      this.adapters.delete(id);
    }
  }

  /** Retrieve an adapter by id. */
  get(id: string): HarnessAdapter | undefined {
    return this.adapters.get(id);
  }

  /** List all registered adapter ids. */
  listAll(): string[] {
    return Array.from(this.adapters.keys());
  }

  /** List ids of adapters that report isAvailable() === true. */
  async listAvailable(): Promise<string[]> {
    const results = await Promise.all(
      Array.from(this.adapters.entries()).map(async ([id, adapter]) => ({
        id,
        available: await adapter.isAvailable(),
      })),
    );
    return results.filter((r) => r.available).map((r) => r.id);
  }

  /** Dispose all adapters and clear the registry. */
  async disposeAll(): Promise<void> {
    await Promise.all(Array.from(this.adapters.values()).map((a) => a.dispose()));
    this.adapters.clear();
  }
}
