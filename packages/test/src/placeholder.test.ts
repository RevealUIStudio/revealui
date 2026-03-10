/**
 * Smoke test for the test package
 *
 * Verifies that the package's submodules export expected utilities.
 */

import { describe, expect, it } from 'vitest'

describe('@revealui/test', () => {
  it('exports test fixtures', async () => {
    const fixtures = await import('./fixtures/index.js')
    expect(fixtures).toBeDefined()
    expect(Object.keys(fixtures).length).toBeGreaterThan(0)
  })

  it('exports test utilities', async () => {
    const utils = await import('./utils/index.js')
    expect(utils).toBeDefined()
    expect(Object.keys(utils).length).toBeGreaterThan(0)
  })

  it('exports mock helpers', async () => {
    const mocks = await import('./mocks/index.js')
    expect(mocks).toBeDefined()
    expect(Object.keys(mocks).length).toBeGreaterThan(0)
  })
})
