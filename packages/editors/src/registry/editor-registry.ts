import type { EditorAdapter, EditorInfo } from '../types/index.js'

export class EditorRegistry {
  private adapters = new Map<string, EditorAdapter>()

  register(adapter: EditorAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter already registered: ${adapter.id}`)
    }
    this.adapters.set(adapter.id, adapter)
  }

  unregister(id: string): void {
    const adapter = this.adapters.get(id)
    if (adapter) {
      adapter.dispose()
      this.adapters.delete(id)
    }
  }

  get(id: string): EditorAdapter | undefined {
    return this.adapters.get(id)
  }

  async listAvailable(): Promise<EditorInfo[]> {
    const results: EditorInfo[] = []
    for (const adapter of this.adapters.values()) {
      if (await adapter.isAvailable()) {
        results.push(await adapter.getInfo())
      }
    }
    return results
  }

  listAll(): string[] {
    return Array.from(this.adapters.keys())
  }

  async disposeAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.dispose()
    }
    this.adapters.clear()
  }
}
