/**
 * Backward-compat shim. The implementation moved to
 * `@revealui/mcp/remote-client` so the API app can share it with admin
 * without duplicating OAuth-provider wiring. Existing admin imports keep
 * working via this re-export.
 */

export {
  type BuildRemoteMcpClientOptions,
  type BuiltRemoteMcpClient,
  buildRemoteMcpClient,
  type RemoteServerMeta,
  RemoteServerNotConnectedError,
} from '@revealui/mcp/remote-client';
