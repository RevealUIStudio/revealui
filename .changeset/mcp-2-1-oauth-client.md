---
'@revealui/mcp': minor
---

Add OAuth 2.1 client support — Stage 2 PR-2.1 of the MCP v1 plan. Remote MCP
servers can now be authorized end-to-end without hand-rolling the flow.

- `McpOAuthProvider` implements the SDK's `OAuthClientProvider` interface:
  Authorization Code + PKCE, Dynamic Client Registration (RFC 7591), and
  automatic refresh with OAuth 2.1 §4.12 refresh-token rotation handled
  transparently.
- `Vault` abstracts durable credential storage. `createRevvaultVault()`
  (default) shells out to the `revvault` CLI and persists under
  `mcp/<tenant>/<server>/{tokens,client,verifier,discovery}`. `createMemoryVault()`
  is provided for tests and ephemeral flows.
- `StreamableHttpTransportOptions.authProvider` wires a provider into
  `StreamableHTTPClientTransport`; the SDK drives discovery, DCR, PKCE, and
  refresh from there. `McpClient.finishAuth(code)` delegates to the transport
  to complete the code-for-token exchange after the user returns from consent.
- Importable from `@revealui/mcp` (top level) or `@revealui/mcp/oauth`.
