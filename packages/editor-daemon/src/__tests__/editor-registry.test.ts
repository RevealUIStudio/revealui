import type { EditorAdapter, EditorCommand } from '@revealui/editor-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorRegistry } from '../registry/editor-registry.js'

function createMockAdapter(overrides: Partial<EditorAdapter> = {}): EditorAdapter {
  const id = overrides.id ?? 'mock'
  const name = overrides.name ?? 'Mock Editor'
  const caps = {
    openProject: true,
    openFile: true,
    jumpToLine: false,
    applyConfig: false,
    installExtension: false,
    getRunningInstances: false,
  }
  return {
    id,
    name,
    getCapabilities: () => caps,
    getInfo: async () => ({ id, name, version: '1.0.0', capabilities: caps }),
    isAvailable: async () => true,
    execute: async (cmd: EditorCommand) => ({
      success: true,
      command: cmd.type,
    }),
    onEvent: () => () => {},
    dispose: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('EditorRegistry', () => {
  let registry: EditorRegistry

  beforeEach(() => {
    registry = new EditorRegistry()
  })

  describe('register', () => {
    it('registers an adapter', () => {
      const adapter = createMockAdapter()
      registry.register(adapter)
      expect(registry.get('mock')).toBe(adapter)
    })

    it('throws on duplicate registration', () => {
      registry.register(createMockAdapter())
      expect(() => registry.register(createMockAdapter())).toThrow(
        'Adapter already registered: mock',
      )
    })
  })

  describe('unregister', () => {
    it('removes and disposes an adapter', async () => {
      const adapter = createMockAdapter()
      registry.register(adapter)
      registry.unregister('mock')

      expect(registry.get('mock')).toBeUndefined()
      expect(adapter.dispose).toHaveBeenCalledOnce()
    })

    it('does nothing for unknown id', () => {
      expect(() => registry.unregister('nonexistent')).not.toThrow()
    })
  })

  describe('get', () => {
    it('returns undefined for unknown id', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    it('returns the registered adapter', () => {
      const adapter = createMockAdapter()
      registry.register(adapter)
      expect(registry.get('mock')).toBe(adapter)
    })
  })

  describe('listAll', () => {
    it('returns empty array when no adapters', () => {
      expect(registry.listAll()).toEqual([])
    })

    it('returns all registered adapter ids', () => {
      registry.register(createMockAdapter({ id: 'alpha', name: 'Alpha' }))
      registry.register(createMockAdapter({ id: 'beta', name: 'Beta' }))
      expect(registry.listAll()).toEqual(['alpha', 'beta'])
    })
  })

  describe('listAvailable', () => {
    it('returns only available adapters', async () => {
      registry.register(createMockAdapter({ id: 'available', name: 'Available' }))
      registry.register(
        createMockAdapter({
          id: 'unavailable',
          name: 'Unavailable',
          isAvailable: async () => false,
        }),
      )

      const available = await registry.listAvailable()
      expect(available).toHaveLength(1)
      expect(available[0].id).toBe('available')
    })

    it('returns empty array when none available', async () => {
      registry.register(
        createMockAdapter({
          id: 'gone',
          name: 'Gone',
          isAvailable: async () => false,
        }),
      )
      expect(await registry.listAvailable()).toEqual([])
    })
  })

  describe('disposeAll', () => {
    it('disposes all adapters and clears registry', async () => {
      const a1 = createMockAdapter({ id: 'a1', name: 'A1' })
      const a2 = createMockAdapter({ id: 'a2', name: 'A2' })
      registry.register(a1)
      registry.register(a2)

      await registry.disposeAll()

      expect(a1.dispose).toHaveBeenCalledOnce()
      expect(a2.dispose).toHaveBeenCalledOnce()
      expect(registry.listAll()).toEqual([])
    })
  })
})
