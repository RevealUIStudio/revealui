import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { CollabProvider } from '../yjs-websocket-provider.js'

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3

  url: string
  binaryType = 'blob'
  readyState = MockWebSocket.OPEN
  onopen: ((evt: unknown) => void) | null = null
  onclose: ((evt: unknown) => void) | null = null
  onmessage: ((evt: unknown) => void) | null = null
  onerror: ((evt: unknown) => void) | null = null

  constructor(url: string) {
    this.url = url
    setTimeout(() => this.onopen?.({}), 0)
  }

  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({})
  })
}

describe('CollabProvider', () => {
  let originalWebSocket: typeof globalThis.WebSocket

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket
    // @ts-expect-error - mock WebSocket
    globalThis.WebSocket = MockWebSocket
    vi.useFakeTimers()
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    vi.useRealTimers()
  })

  it('should create provider with doc and awareness', () => {
    const doc = new Y.Doc()
    const provider = new CollabProvider('ws://localhost:3004', 'doc1', doc)

    expect(provider.doc).toBe(doc)
    expect(provider.awareness).toBeDefined()
    expect(provider.awareness.doc).toBe(doc)

    provider.destroy()
    doc.destroy()
  })

  it('should apply initial state if provided', () => {
    const sourceDoc = new Y.Doc()
    sourceDoc.getMap('test').set('key', 'value')
    const initialState = Y.encodeStateAsUpdate(sourceDoc)

    const doc = new Y.Doc()
    const provider = new CollabProvider('ws://localhost:3004', 'doc1', doc, { initialState })

    expect(doc.getMap('test').get('key')).toBe('value')

    provider.destroy()
    doc.destroy()
    sourceDoc.destroy()
  })

  it('should connect and create WebSocket', async () => {
    const doc = new Y.Doc()
    const provider = new CollabProvider('ws://localhost:3004', 'doc1', doc)

    const statusEvents: string[] = []
    provider.on('status', (event: unknown) => {
      statusEvents.push((event as { status: string }).status)
    })

    provider.connect()

    expect(statusEvents).toContain('connecting')

    provider.destroy()
    doc.destroy()
  })

  it('should emit status events on connect', async () => {
    const doc = new Y.Doc()
    const provider = new CollabProvider('ws://localhost:3004', 'doc1', doc)

    const events: string[] = []
    provider.on('status', (event: unknown) => {
      events.push((event as { status: string }).status)
    })

    provider.connect()
    await vi.advanceTimersByTimeAsync(10)

    expect(events).toContain('connected')

    provider.destroy()
    doc.destroy()
  })

  it('should disconnect and emit status', () => {
    const doc = new Y.Doc()
    const provider = new CollabProvider('ws://localhost:3004', 'doc1', doc)

    const events: string[] = []
    provider.on('status', (event: unknown) => {
      events.push((event as { status: string }).status)
    })

    provider.connect()
    provider.disconnect()

    expect(events).toContain('disconnected')

    provider.destroy()
    doc.destroy()
  })

  it('should not create multiple connections', () => {
    const doc = new Y.Doc()
    const provider = new CollabProvider('ws://localhost:3004', 'doc1', doc)

    provider.connect()
    provider.connect() // second call should be no-op

    provider.destroy()
    doc.destroy()
  })

  it('should clean up on destroy', () => {
    const doc = new Y.Doc()
    const provider = new CollabProvider('ws://localhost:3004', 'doc1', doc)

    provider.connect()
    provider.destroy()

    // Should not throw after destroy
    expect(() => provider.destroy()).not.toThrow()
    doc.destroy()
  })

  it('should have awareness stub with basic methods', () => {
    const doc = new Y.Doc()
    const provider = new CollabProvider('ws://localhost:3004', 'doc1', doc)

    const awareness = provider.awareness
    expect(awareness.getLocalState()).toBeNull()

    awareness.setLocalState({ name: 'Test' })
    expect(awareness.getLocalState()).toEqual({ name: 'Test' })

    awareness.setLocalStateField('color', 'blue')
    expect(awareness.getLocalState()).toEqual({ name: 'Test', color: 'blue' })

    expect(awareness.getStates()).toBeInstanceOf(Map)

    provider.destroy()
    doc.destroy()
  })
})
