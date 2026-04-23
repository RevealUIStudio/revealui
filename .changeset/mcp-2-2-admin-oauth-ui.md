---
'admin': minor
---

Add the admin-side OAuth 2.1 connect flow for remote MCP servers — Stage 2
PR-2.2 of the MCP v1 plan. Pairs with the client-side provider shipped in
PR-2.1 (#494).

- `GET /api/mcp/oauth/initiate` — runs SDK discovery + Dynamic Client
  Registration + PKCE against the target server, stores a pending record in
  revvault keyed by the authorization state, and 302-redirects to the
  authorization URL.
- `GET /api/mcp/oauth/callback` — finalizes the flow: looks up the pending
  record, validates session + TTL (10 min) + one-shot consumption, exchanges
  the code for tokens, and redirects back to `/admin/mcp/connect` with a
  `connected=` or `error=` indicator.
- `/admin/mcp/connect` — minimal generic form (tenant, server, serverUrl).
  No per-server branding; polished per-server UX lands with RevMarket (v1.1).
- `@revealui/mcp` added as a regular dependency of `admin` (previously only
  a peer); OAuth routes import from `@revealui/mcp/oauth`.
