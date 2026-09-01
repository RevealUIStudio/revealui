---
visibility: public
status: verified
title: "Collaborative editing"
description: "What shared Lexical editing does today for self-hosted operators, and what is not shipped"
category: guide
audience: enterprise
---

How multi-user editing works in a self-hosted RevealUI deployment. This is an operator guide for the code that already ships. It does not add comments, suggestions, or a latency SLA.

Product tracker: [#514](https://github.com/RevealUIStudio/revealui/issues/514).

---

## What ships today

| Piece | Where | Status |
|-------|-------|--------|
| Yjs document | `packages/sync/src/collab/` | Shipped |
| WebSocket transport | `packages/sync/src/collab/yjs-websocket-provider.ts` | Shipped |
| Room manager | `apps/server/src/collab/room-manager.ts` | Shipped |
| Awareness / presence | Same provider + room manager (`MESSAGE_AWARENESS`) | Shipped |
| Remote cursors in Lexical | `packages/core/src/client/richtext/plugins/CollaborationPlugin.tsx` | Shipped |
| Offline replay (last-write-wins / server-wins / manual) | `packages/sync/src/conflict-resolution.ts` | Shipped; not the in-flight CRDT path |

Collab syncs over the WebSocket room manager. There is no `/api/shapes/yjs-documents` Electric shape for this path. ElectricSQL hooks are a separate, optional sync layer.

---

## What does not ship

- Comment primitives on shared docs
- Inline suggestion / review primitives
- Multi-user Playwright coverage (5- and 10-user sessions)
- A measured sub-100ms propagation target
- A published reconnect-persistence guarantee beyond "Yjs doc + debounce persist"

Roadmap still lists "real-time multi-user collaboration beyond current ElectricSQL shapes and Yjs text" under Later. Treat this guide as the honest subset you can run.

---

## Enable it in the editor

`RichTextEditor` takes a `collaborative` flag. Cursors render only when `collaborative`, `documentId`, and `providerFactory` are all set.

```tsx
import { RichTextEditor } from '@revealui/core/richtext/client'

<RichTextEditor
  collaborative
  documentId={documentId}
  username={currentUser.name}
  cursorColor="#2563eb"
  clientType="human"
  providerFactory={(id, yjsDocMap) => {
    // Return a yjs Provider pointed at your API WebSocket room
    // See packages/sync/src/collab/yjs-websocket-provider.ts
  }}
/>
```

`clientType` may be `'human' | 'agent'`. Agents can show a model label via `agentModel`.

---

## Operator notes (self-hosted / Fleet)

1. **The API process must stay up.** Rooms live in `apps/server`. Serverless-only hosts that freeze WebSocket workers will drop presence. Studio's own long-running path is Fly (`apps/server/fly.toml`). Fleet Compose keeps the API container running.
2. **Persistence is debounced.** `room-manager.ts` saves Yjs snapshots after `DEBOUNCE_MS` (2s) of quiet. A process crash inside that window can lose the unsaved tail. The durability hedge in [ADR 2026-06-13](../decisions/2026-06-13-collab-snapshot-durability.md) is accepted but **not implemented** until there is production evidence of loss.
3. **Reconnect.** The client provider retries with backoff (`MAX_RECONNECT_ATTEMPTS = 10`). That is reconnect-to-room, not a proven "zero loss" guarantee.
4. **Auth.** Treat the collab WebSocket as a privileged channel. Do not expose it without the same session checks you use for collection writes.
5. **OSS vs Pro.** Presence and CRDT editing do not import `@revealui/ai`. They work on the OSS editor + sync packages. Enterprise is the usual self-host context, not a feature-flag name for cursors.

---

## Offline vs in-flight conflict

Keep both paths in mind:

- **In-flight:** Yjs CRDT merges concurrent edits in the room.
- **Offline replay:** `packages/sync/src/conflict-resolution.ts` is last-write-wins / server-wins / manual merge after a disconnect. It does not replace the CRDT.

---

## Related

- [Enterprise](../ENTERPRISE.md)
- [Deployment](./deployment.md)
- [SLA](../SLA.md) — published uptime covers Studio license/download infra, not your collab WebSocket
- [ADR: collab snapshot durability](../decisions/2026-06-13-collab-snapshot-durability.md)
