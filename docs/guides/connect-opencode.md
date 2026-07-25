---
title: "Connect OpenCode"
description: "Connect the OpenCode CLI to a RevealUI instance through the governed MCP endpoint, so OpenCode becomes a governed and audited user of your data."
visibility: public
status: verified
audience: developer
---

# Connect OpenCode

OpenCode can reach a RevealUI instance's data through the governed Model
Context Protocol (MCP) endpoint. Every tool call OpenCode makes runs as a
specific, authenticated RevealUI user. It is authorized the same way a human
request is, and it leaves a receipt in the audit log. This guide walks
through the connection from a fresh OpenCode install to a working tool call.

## What governance means here

OpenCode brings its own model. RevealUI never hosts a frontier model or ships
a proprietary model SDK. What RevealUI provides is the governed data layer:
identity, authorization, and an audit trail for everything an agent touches.

- **Authenticated.** Every request carries your own bearer token. There is no
  shared service key on this path.
- **Authorized.** The same role-based and row-level access rules that govern
  a human's requests govern the agent's requests. An agent can only reach
  what its user is allowed to reach.
- **Audited.** Every tool call writes a receipt to the audit log. If an agent
  did it, there is a receipt you can check.
- **Revocable.** Revoking the device token cuts access immediately. The
  server re-validates the token on every request (`apps/server/src/middleware/auth.ts:26`),
  not only when a session starts, so a revoked token stops working on its
  very next request.

## Prerequisites

- A RevealUI account on the instance you want to connect to.
- The `opencode` CLI installed and on your `PATH`.
- A device token minted through the studio-auth device flow (below).

## 1. Mint a device token

RevealUI authenticates programmatic clients, including CLIs, with device
tokens rather than session cookies. Minting one is a two-step email
verification flow:

1. Request a code: send your email and a device name to the instance's
   studio-auth link endpoint. RevealUI emails you a one-time verification
   code.
2. Verify the code: exchange the code for a bearer token.

Your RevealUI instance's admin console or CLI tooling wraps this flow for
you. The resulting token has the shape `rvui_dev_<64 hex characters>` and is
valid for a configurable lifetime (30 days by default). Treat it like a
password: never paste it into a chat, a committed file, or a shared
terminal.

## 2. Store the token as an environment variable

Export the token in your shell, or store it in whatever secret manager your
own environment uses, and load it before running `opencode`. The token
itself never belongs in a committed config file.

```bash
export REVEALUI_MCP_TOKEN="rvui_dev_your_token_here"
```

## 3. Configure OpenCode

Add a `mcp` entry to your project's `opencode.json` pointing at the
instance's governed MCP endpoint. The `{env:...}` syntax tells OpenCode to
read the token from your environment at run time instead of storing it in
the file:

```jsonc
// opencode.json
{
  "mcp": {
    "revealui": {
      "type": "remote",
      "url": "https://<your-host>/api/mcp",
      "headers": { "Authorization": "Bearer {env:REVEALUI_MCP_TOKEN}" },
      "oauth": false,
      "enabled": true
    }
  },
  "tools": { "revealui*": true }
}
```

Replace `<your-host>` with your RevealUI instance's hostname. The
`{env:REVEALUI_MCP_TOKEN}` substitution means the committed file never
contains a literal token value, only a pointer to where OpenCode should read
it from.

## 4. Confirm the connection

```bash
opencode mcp list
```

You should see the `revealui` server listed as connected, along with its
URL.

## 5. Understand the tool names

Every tool RevealUI exposes over MCP is named `<server>_<tool>`. Since the
server is registered as `revealui` in your config, a tool like
`list_sites` shows up to OpenCode as `revealui_revealui_list_sites`. The
doubled prefix looks unusual at first: the first `revealui` is the MCP
server name from your config, and the second is the tool's own name inside
that server.

## 6. Run a task

```bash
opencode run "List my RevealUI sites"
```

OpenCode calls the governed tool using your token. The response is scoped to
what your account can see, and a receipt for the call lands in your RevealUI
instance's audit log.

## Rotating or revoking the token

There is no separate rotation flow. To rotate, revoke the current token and
mint a new one. Revocation takes effect on the token's very next use, mid
session included, because the server checks the token on every request
rather than trusting a cached session.

## Troubleshooting

- **401 responses:** the token is missing, expired, or revoked. Mint a new
  one and update `REVEALUI_MCP_TOKEN`.
- **Tool not listed:** `tools/list` only returns tools your account is
  permitted to execute. A tool missing from discovery is denied by design,
  not a bug.
- **Session errors after a network interruption:** MCP session identifiers
  are routing state, not credentials. If your token is still valid,
  reconnecting establishes a fresh session automatically.

## Sources

- Per-request bearer validation (revocation takes effect on the next request): `apps/server/src/middleware/auth.ts:26`
- Governed endpoint session binding and identity threading: `apps/server/src/routes/mcp-endpoint.ts:135`
- Device token mint and revocation flow: `apps/server/src/routes/studio-auth.ts:87`
