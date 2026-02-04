/**
 * Import Verification Tests for @revealui/ai
 *
 * These tests verify that all export paths work correctly after reorganization.
 *
 * Fixed: VectorMemoryService now uses lazy database initialization (getter pattern),
 * so imports no longer trigger immediate database connections.
 */

import { describe, expect, it } from 'vitest'

describe('@revealui/ai - Import Paths', () => {
  it('should import from memory export', async () => {
    const memory = await import('@revealui/ai/memory')
    expect(memory).toBeDefined()
  })

  it('should import from client export', async () => {
    const client = await import('@revealui/ai/client')
    expect(client).toBeDefined()
    // Hooks may be empty if not fully implemented
  })

  it('should import from main package export', async () => {
    const main = await import('@revealui/ai')
    expect(main).toBeDefined()
  })

  it('should have consistent exports between memory and main', async () => {
    const memory = await import('@revealui/ai/memory')
    const main = await import('@revealui/ai')

    // Main should re-export everything from memory
    expect(main).toMatchObject(memory)
  })

  it('should have consistent exports between client and main', async () => {
    const client = await import('@revealui/ai/client')
    const main = await import('@revealui/ai')

    // Main should re-export everything from client
    expect(main).toMatchObject(client)
  })
})
