# OpenCode live walk (owner-run, not CI)

This is a manual, reproducible walk against a real RevealUI deployment and a
real `opencode` binary. It is **not** part of the automated test suite: it
needs a live gateway, a real device token, and network access, none of which
belong in CI (no network-dependent or model-dependent checks run there -- see
`opencode-adapter.test.ts` and `opencode-config.test.ts` for the deterministic
fixture-based coverage that does).

Run this walk whenever `opencode` ships a new major/minor version, or when the
governed `/api/mcp` endpoint's auth/session behavior changes, to re-pin
`parseOpenCodeRunOutput` (`../src/adapters/opencode-adapter.ts`) against
reality.

## Prerequisites

- A RevealUI account on the target instance.
- The `opencode` CLI installed (`npm install -g opencode-ai`, the curl
  installer, or brew) and on `PATH`.
- `curl` and `jq` for the manual HTTP steps.

## 1. Mint a device token

```bash
curl -s -X POST https://<your-host>/api/studio-auth/link \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","deviceId":"opencode-live-walk","deviceName":"OpenCode live walk","deviceType":"cli"}'
```

Read the OTP from the email RevealUI sends, then exchange it for a bearer
token:

```bash
curl -s -X POST https://<your-host>/api/studio-auth/verify \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","deviceId":"opencode-live-walk","code":"<otp-from-email>"}' \
  | jq -r '.token'
```

The response token has the shape `rvui_dev_<64-hex-chars>`. Export it for the
rest of the walk; do not paste it anywhere it could be committed or logged.

```bash
export REVEALUI_MCP_TOKEN='<the-token-from-above>'
```

## 2. Write the project config

In a scratch project directory, write `opencode.json` with the exact block
from [`docs/guides/connect-opencode.md`](../../../docs/guides/connect-opencode.md)
(the `{env:REVEALUI_MCP_TOKEN}` substitution, never a literal token).

## 3. Confirm the MCP connection

```bash
opencode mcp list
```

Expect a connected-status listing that names the `revealui` server and its
URL.

## 4. Drive a real tool-using turn and capture the raw event stream

```bash
opencode run -m <your-model> --format json "List my RevealUI sites" \
  | tee /tmp/opencode-live-walk-raw.jsonl
```

- Confirm exit code `0` and empty stderr.
- Confirm every line of `/tmp/opencode-live-walk-raw.jsonl` parses as JSON
  and matches the envelope `{type, timestamp, sessionID, part}`.
- Compare the observed `type`/`part.type` sequence against the header comment
  in `parseOpenCodeRunOutput` (`../src/adapters/opencode-adapter.ts`). If the
  shape drifted, update the parser, its tests, and this doc together.
- Confirm `parseOpenCodeRunOutput` (run it locally against the captured file,
  e.g. via a scratch Node script) extracts the same final text the CLI
  printed.

**Discard `/tmp/opencode-live-walk-raw.jsonl` when done** -- it may contain
real site names or other account data; never commit it.

## 5. Confirm mid-session revocation

While the same `opencode` session is still warm, revoke the device token from
another terminal:

```bash
curl -s -X DELETE https://<your-host>/api/studio-auth/revoke \
  -H "authorization: Bearer $REVEALUI_MCP_TOKEN"
```

Then issue another `opencode run` (or `opencode mcp list`) using the same
config. Expect the next request on the revoked session to fail with an
authentication error (HTTP 401) -- the governed endpoint re-validates the
bearer token per request, so revocation takes effect immediately, not just at
the next session `initialize`.

## 6. Clean up

- Revoke the token if step 5 was skipped.
- Remove the scratch project directory and the captured JSONL file.
- Unset `REVEALUI_MCP_TOKEN` in the shell.
