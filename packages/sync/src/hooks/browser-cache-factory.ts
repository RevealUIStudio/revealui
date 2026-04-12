/**
 * Browser cache factory for PGlite-backed offline cache.
 * Separated into its own file so tests can vi.mock() it without
 * triggering PGlite WASM loading in jsdom.
 * @internal
 */

interface CacheStoreLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds: number, tags?: string[]): Promise<void>;
  delete(...keys: string[]): Promise<number>;
  close(): Promise<void>;
}

export async function createOfflineCache(): Promise<CacheStoreLike | null> {
  try {
    const specifier = ['@revealui', 'cache', 'adapters'].join('/');
    const mod = await (Function('s', 'return import(s)')(specifier) as Promise<{
      createBrowserCache: (opts?: { dbName?: string }) => Promise<CacheStoreLike>;
    }>);
    return await mod.createBrowserCache({ dbName: 'revealui-offline' });
  } catch {
    return null;
  }
}
