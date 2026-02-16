import { describe, expect, it, vi } from 'vitest'
import { EditorRegistry } from '../registry/editor-registry.js'
import type { EditorAdapter } from '../types/adapter.js'

function createMockAdapter(id: string, available = true): EditorAdapter {
  return {
    id,
    name: `${id} Editor`,
    getCapabilities: () => ({ canOpenFile: true, canDiff: false, canRefactor: false }),
    getInfo: vi.fn().mockResolvedValue({ id, name: `${id} Editor`, version: '1.0.0' }),
    isAvailable: vi.fn().mockResolvedValue(available),
    execute: vi.fn().mockResolvedValue({ success: true }),
    onEvent: vi.fn().mockReturnValue(() => {}),
    dispose: vi.fn().mockResolvedValue(undefined),
  }
}

describe('EditorRegistry', () => {
  it('registers an adapter', () => {
    const registry = new EditorRegistry()
    const adapter = createMockAdapter('zed')
    registry.register(adapter)
    expect(registry.get('zed')).toBe(adapter)
  })

  it('throws on duplicate registration', () => {
    const registry = new EditorRegistry()
    registry.register(createMockAdapter('zed'))
    expect(() => registry.register(createMockAdapter('zed'))).toThrow(
      'Adapter already registered: zed',
    )
  })

  it('returns undefined for unregistered adapters', () => {
    const registry = new EditorRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('unregisters and disposes an adapter', async () => {
    const registry = new EditorRegistry()
    const adapter = createMockAdapter('vscode')
    registry.register(adapter)
    registry.unregister('vscode')
    expect(registry.get('vscode')).toBeUndefined()
    expect(adapter.dispose).toHaveBeenCalled()
  })

  it('silently handles unregistering a nonexistent adapter', () => {
    const registry = new EditorRegistry()
    expect(() => registry.unregister('nonexistent')).not.toThrow()
  })

  it('lists all registered adapter IDs', () => {
    const registry = new EditorRegistry()
    registry.register(createMockAdapter('zed'))
    registry.register(createMockAdapter('vscode'))
    registry.register(createMockAdapter('neovim'))
    expect(registry.listAll()).toEqual(['zed', 'vscode', 'neovim'])
  })

  it('lists only available adapters', async () => {
    const registry = new EditorRegistry()
    registry.register(createMockAdapter('zed', true))
    registry.register(createMockAdapter('vscode', false))
    registry.register(createMockAdapter('neovim', true))
    const available = await registry.listAvailable()
    expect(available).toHaveLength(2)
  })

  it('disposes all adapters', async () => {
    const registry = new EditorRegistry()
    const a = createMockAdapter('zed')
    const b = createMockAdapter('vscode')
    registry.register(a)
    registry.register(b)
    await registry.disposeAll()
    expect(a.dispose).toHaveBeenCalled()
    expect(b.dispose).toHaveBeenCalled()
    expect(registry.listAll()).toHaveLength(0)
  })
})
