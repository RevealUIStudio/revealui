---
"@revealui/sync": patch
---

Make `useConversations(_userId?)` param optional — it was kept for API compat but unused (filtering enforced server-side in the proxy). Backwards-compatible.
