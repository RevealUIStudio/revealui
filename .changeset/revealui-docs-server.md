---
"@revealui/mcp": minor
---

Add the `revealui-docs` MCP server — first-party dependency intelligence. Resolves `@revealui/*` library names and serves curated docs (README + package metadata + public export subpaths) from the monorepo, exported via `@revealui/mcp/docs-server` with a stdio launcher at `servers/docs.ts`. Phase 1 covers first-party packages only; npm/third-party source via `opensrc` is a later phase.
