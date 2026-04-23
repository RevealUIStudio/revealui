---
'@revealui/contracts': minor
'@revealui/mcp': minor
---

Stage 4.1 of the MCP v1 plan — expose RevealUI content as MCP resources.
First cut of the content-pipeline-as-resources arc; the admin UI opt-out
toggle + `revealui://<tenant>/…` URI scheme land with Stage 4.2.

**`@revealui/contracts`:**
- `CollectionStructure.mcpResource?: boolean` — declarative opt-out for
  exposing a collection's rows to MCP clients. Default behavior (when
  absent) is to expose. Added to both the TypeScript interface and the
  `CollectionStructureSchema` Zod schema.

**`@revealui/mcp`:**
- `revealui-content` server advertises the `resources` capability.
- `resources/list` walks a curated default set (`posts`, `pages`,
  `products`, `media`) and returns one resource per row under the URI
  scheme `revealui-content://<collection>/<id>`. Partial upstream
  failure is tolerated — an unavailable collection doesn't blank the
  rest of the list.
- `resources/read` parses the URI, fetches the record from
  `/api/<collection>/<id>`, and returns the JSON verbatim as an
  `application/json` text block.
- Malformed URIs + collections outside the default set throw with
  clear messages.

5 new integration tests (mcp: 195 → 200 passing / 5 skipped). The
curated default set is the minimum-viable surface — collection-config
introspection (which consults `mcpResource`) lands with Stage 4.2
alongside the admin UI toggle.
