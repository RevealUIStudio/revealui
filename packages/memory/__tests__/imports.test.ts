/**
 * Import Verification Tests for @revealui/memory
 *
 * These tests verify that all export paths work correctly after reorganization.
 */

import { describe, expect, it } from 'vitest'

describe('@revealui/memory - Import Paths', () => {
  it('should import from core export', async () => {
    const core = await import('@revealui/memory/core')
    expect(core).toBeDefined()
    // CRDT exports may be empty if not fully implemented
  })

  it('should import from client export', async () => {
    const client = await import('@revealui/memory/client')
    expect(client).toBeDefined()
    // Hooks may be empty if not fully implemented
  })

  it('should import from main package export', async () => {
    const main = await import('@revealui/memory')
    expect(main).toBeDefined()
  })

  it('should have consistent exports between core and main', async () => {
    const core = await import('@revealui/memory/core')
    const main = await import('@revealui/memory')

    // Main should re-export everything from core
    expect(main).toMatchObject(core)
  })

  it('should have consistent exports between client and main', async () => {
    const client = await import('@revealui/memory/client')
    const main = await import('@revealui/memory')

    // Main should re-export everything from client
    expect(main).toMatchObject(client)
  })
})
