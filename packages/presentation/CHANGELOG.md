# @revealui/presentation

## 0.3.3

### Patch Changes

- fix: security hardening, CodeQL fixes, docs, and dependency cleanup

  - Replace regex with string methods across source code (CodeQL)
  - Harden CLI content pull and remove trivial conditionals
  - Fix router dependency (core → utils) to resolve DTS build OOM
  - Add migration 0006 indexes for agent_actions, crdt_operations, boards, ticket_labels
  - Remove legacy Supabase-era billing handlers from services
  - Re-export agentMemories from db schema for published @revealui/ai compat
  - Add publishConfig.registry consistency to editors, mcp, services
  - Add READMEs and JSDoc across all packages

## 0.3.2

### Patch Changes

- Frontend polish across presentation components

## 0.3.1

### Patch Changes

- 08d9acd: Upgrade build toolchain: vite 7→8, jsdom 27→29, @vitejs/plugin-react 5→6, flexsearch 0.7→0.8. Migrate rollupOptions→rolldownOptions and esbuild→oxc for Vite 8.

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI UI component library.

  - 50+ production-ready React 19 components
  - Built with Tailwind CSS v4
  - Functional components with composable APIs
  - Server and client component exports
