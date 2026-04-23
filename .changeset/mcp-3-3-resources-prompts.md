---
'admin': minor
---

Stage 3.3 of the MCP v1 plan — resource browser, prompt picker, and
completion-aware prompt argument inputs. Builds on Stages 2, 3.1, and 3.2.

- Four new per-server routes:
  - `GET /api/mcp/remote-servers/[server]/resources?tenant=X` — list resources.
  - `GET /api/mcp/remote-servers/[server]/resource?tenant=X&uri=...` — read a single resource; returns the full `ResourceContents[]` (text + blob blocks).
  - `GET /api/mcp/remote-servers/[server]/prompts?tenant=X` — list prompts.
  - `POST /api/mcp/remote-servers/[server]/get-prompt` — resolve a prompt with string-valued arguments; returns the full `GetPromptResult`.
- `/admin/mcp/inspect` gets tabbed navigation — **Tools** (3.2) / **Resources** / **Prompts**. The Tools panel is unchanged.
- **Resources tab:** master-detail layout with a resource list on the left and a read-only preview pane on the right. Text blocks render in a monospace viewer; binary blobs surface their mime type + base64 size without decoding.
- **Prompts tab:** collapsible cards with a resolve form per prompt. Argument inputs are **completion-aware** — as the user types, a 200ms-debounced POST to `/complete` (shipped in PR-3.2) fetches server-side suggestions and feeds them into a native `<datalist>`. First real consumer of the completions plumbing.
- 11 new route tests (admin: 1560 → 1571). Adversarial inputs, capability errors, transport teardown all covered.
