import { beforeEach, describe, expect, it, vi } from 'vitest'

// Track created providers for assertions
const createdProviders: Array<{
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  awareness: { destroy: ReturnType<typeof vi.fn> }
}> = []

let shouldThrowOnConstruct = false

vi.mock('../yjs-websocket-provider.js', () => ({
  CollabProvider: class MockCollabProvider {
    connect = vi.fn()
    disconnect = vi.fn()
    destroy = vi.fn()
    on = vi.fn()
    off = vi.fn()
    awareness = { destroy: vi.fn() }

    constructor() {
      if (shouldThrowOnConstruct) {
        shouldThrowOnConstruct = false
        throw new Error('Connection failed')
      }
      createdProviders.push(this)
    }
  },
}))

vi.mock('yjs', () => ({
  Doc: class MockDoc {
    destroy = vi.fn()
    clientID = 1
    on = vi.fn()
    off = vi.fn()
  },
  applyUpdate: vi.fn(),
  encodeStateAsUpdate: vi.fn(() => new Uint8Array()),
  encodeStateVector: vi.fn(() => new Uint8Array()),
}))

import { renderHook } from '@testing-library/react'
import { useCollaboration } from '../use-collaboration.js'

describe('useCollaboration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createdProviders.length = 0
    shouldThrowOnConstruct = false
  })

  it('should return initial state when not enabled', () => {
    const { result } = renderHook(() =>
      useCollaboration({
        documentId: 'doc1',
        serverUrl: 'ws://localhost:3004',
        enabled: false,
      }),
    )

    expect(result.current.synced).toBe(false)
    expect(result.current.status).toBe('disconnected')
    expect(result.current.error).toBeNull()
    expect(createdProviders).toHaveLength(0)
  })

  it('should create provider and connect when enabled', () => {
    renderHook(() =>
      useCollaboration({
        documentId: 'doc1',
        serverUrl: 'ws://localhost:3004',
        enabled: true,
      }),
    )

    expect(createdProviders).toHaveLength(1)
    expect(createdProviders[0].connect).toHaveBeenCalled()
  })

  it('should register sync and status event listeners', () => {
    renderHook(() =>
      useCollaboration({
        documentId: 'doc1',
        serverUrl: 'ws://localhost:3004',
        enabled: true,
      }),
    )

    expect(createdProviders).toHaveLength(1)
    expect(createdProviders[0].on).toHaveBeenCalledWith('sync', expect.any(Function))
    expect(createdProviders[0].on).toHaveBeenCalledWith('status', expect.any(Function))
  })

  it('should clean up on unmount', () => {
    const { unmount } = renderHook(() =>
      useCollaboration({
        documentId: 'doc1',
        serverUrl: 'ws://localhost:3004',
        enabled: true,
      }),
    )

    expect(createdProviders).toHaveLength(1)
    unmount()
    expect(createdProviders[0].destroy).toHaveBeenCalled()
  })

  it('should not connect when documentId is empty', () => {
    const { result } = renderHook(() =>
      useCollaboration({
        documentId: '',
        serverUrl: 'ws://localhost:3004',
        enabled: true,
      }),
    )

    expect(result.current.synced).toBe(false)
    expect(createdProviders).toHaveLength(0)
  })

  it('should handle error during provider creation', () => {
    shouldThrowOnConstruct = true

    const { result } = renderHook(() =>
      useCollaboration({
        documentId: 'doc1',
        serverUrl: 'ws://localhost:3004',
        enabled: true,
      }),
    )

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Connection failed')
  })
})
