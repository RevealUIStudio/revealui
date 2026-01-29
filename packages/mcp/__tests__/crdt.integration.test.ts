import adapters from 'packages/mcp/src/adapters/db'
import { describe, expect, it } from 'vitest'

describe('CRDT integration (smoke)', () => {
  it('adapter functions exist', () => {
    expect(typeof adapters.connectPglite).toBe('function')
    expect(typeof adapters.connectPostgres).toBe('function')
  })

  it.skip('should run integration scenario with pglite and concurrent writers', async () => {
    // TODO: implement full compose-based integration test
    // Steps:
    // - start mcp/docker-compose.yml services
    // - wait for readiness
    // - create concurrent writer processes that write to same document
    // - assert merged state deterministic and contains expected ops
  })
})
