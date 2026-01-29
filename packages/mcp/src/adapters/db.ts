/*
  DB adapter skeleton for MCP.
  - `connectPglite()` should initialize ElectricSQL/pglite client and ensure CRDT metadata columns where applicable.
  - `connectPostgres()` should create a standard Postgres client and ensure Electric metadata exists.

  TODO: replace stubs with actual ElectricSQL and pg client wiring.
*/

import getMcpConfig from 'packages/config/src/mcp'

export type McpDbClient = {
  query: (sql: string, params?: any[]) => Promise<any>
  close: () => Promise<void>
}

export async function connectPglite(): Promise<McpDbClient> {
  const cfg = getMcpConfig()
  // TODO: initialize @electric-sql/pglite here and return a thin client
  // For now, provide a stub client that throws if used without implementation.
  return {
    query: async () => {
      throw new Error('connectPglite() not implemented — wire @electric-sql/pglite here')
    },
    close: async () => {},
  } as McpDbClient
}

export async function connectPostgres(): Promise<McpDbClient> {
  const cfg = getMcpConfig()
  // TODO: wire pg Pool here, create or verify `_electric_meta` columns for CRDT use
  return {
    query: async () => {
      throw new Error('connectPostgres() not implemented — wire pg client here')
    },
    close: async () => {},
  } as McpDbClient
}

export default { connectPglite, connectPostgres }
