interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class SecretCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(key: string): string | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt !== 0 && Date.now() > hit.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: string, ttlMs: number): void {
    if (ttlMs <= 0) return;
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
