---
'@revealui/harnesses': minor
---

Rename VAUGHN protocol → Harness Protocol. Trim companion spec doc to match shipping reality.

The 2026-05-18 audit found the original VAUGHN spec oversold what the code actually shipped — one working adapter for the RevealUI Agent, plus static capability-profile data for three tools (Claude Code, Codex, Cursor) that have no adapter wrapping them. The founder-name backronym also read as a vanity stamp on engineering documentation. Renamed to "Harness Protocol" — matches the existing `@revealui/harnesses` package name and the existing `HarnessAdapter` / `HarnessCoordinator` types. See `docs/HARNESS_PROTOCOL.md` for the trimmed, honestly-scoped spec (714 → ~200 lines).

**Breaking — code symbols renamed** (1:1 mapping):

- All `Vaughn*` types → `Protocol*` (`VaughnAdapter`, `VaughnAdapterInfo`, `VaughnCapabilities`, `VaughnCommand`, `VaughnCommandResult`, `VaughnConfig`, `VaughnError`, `VaughnErrorCode`, `VaughnEvent`, `VaughnEventEnvelope`, `VaughnRule`, `VaughnSkill`)
- Constants: `VAUGHN_VERSION` → `PROTOCOL_VERSION`, `VAUGHN_EVENTS` → `PROTOCOL_EVENTS`
- Schemas: `vaughnEventSchema` → `protocolEventSchema`, `vaughnEventEnvelopeSchema` → `protocolEventEnvelopeSchema`
- Class `VaughnEventNormalizer` → `EventNormalizer`
- Config functions: `vaughnConfigTo*` → `protocolConfigTo*`, `claudeSettingsToVaughnConfig` → `claudeSettingsToProtocolConfig`
- `HarnessCoordinator.registerVaughnCapabilities` → `registerProtocolCapabilities`
- `RpcServer.setVaughnDispatch` → `setProtocolDispatch`, `RpcServer.pushVaughnEvent` → `pushProtocolEvent`
- `RevealUIAgentAdapter.getVaughnCapabilities` → `getProtocolCapabilities`, `onVaughnEvent` → `onProtocolEvent`

**Breaking — package subpath export:** `@revealui/harnesses/vaughn` → `@revealui/harnesses/protocol`.

**Breaking — env var:** `VAUGHN_AGENT_ID` → `PROTOCOL_AGENT_ID`. Legacy variable still read as a fallback with a one-time deprecation warning on stderr.

**Breaking — session-cache file path:** `/tmp/vaughn-session-<ppid>.id` → `/tmp/protocol-session-<ppid>.id`. Legacy path still read as a fallback.

**Preserved for wire-format stability:** JSON-RPC method names `vaughn.capabilities`, `vaughn.dispatch`, `vaughn.events`, `vaughn.config.sync` are unchanged so existing daemon consumers (notably revdev) keep working. A coordinated rename to `protocol.*` is tracked separately.
