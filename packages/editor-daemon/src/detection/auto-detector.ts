import type { EditorAdapter } from '@revealui/editor-sdk'
import { NeovimAdapter } from '../adapters/neovim-adapter.js'
import { VscodeAdapter } from '../adapters/vscode-adapter.js'
import { ZedAdapter } from '../adapters/zed-adapter.js'
import type { EditorRegistry } from '../registry/editor-registry.js'

/** All known adapter constructors */
function createAllAdapters(): EditorAdapter[] {
  return [new ZedAdapter(), new VscodeAdapter(), new NeovimAdapter()]
}

/**
 * Auto-detect available editors and register them.
 * Checks isAvailable() for each adapter; registers if found, disposes if not.
 */
export async function autoDetectEditors(registry: EditorRegistry): Promise<string[]> {
  const adapters = createAllAdapters()
  const registered: string[] = []

  for (const adapter of adapters) {
    if (await adapter.isAvailable()) {
      registry.register(adapter)
      registered.push(adapter.id)
    } else {
      await adapter.dispose()
    }
  }

  return registered
}
