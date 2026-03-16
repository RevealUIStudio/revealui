# Wave 4: Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract core security into a standalone package and add Studio desktop polish (UI primitives, SSH bookmark sidebar, panel refactoring).

**Architecture:** Task 1 (/ee restructure) is already complete — Pro packages are dist-only npm installs and `pnpm-workspace.yaml` already includes `ee/packages/*`. Task 2 creates `packages/security/` by moving `packages/core/src/security/` modules into their own package, with backwards-compat re-exports from `@revealui/core/security`. Task 3 adds missing UI primitives to Studio, an SSH bookmark sidebar, and refactors panels to use the Card primitive.

**Tech Stack:** TypeScript 5.9, Vitest 4, tsup, Hono, Tauri 2/Rust, React 19, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-16-remaining-work-execution-design.md` — Wave 4

---

## Task 1: /ee Folder Restructure — ALREADY COMPLETE

**Pre-research finding:** Pro packages (`@revealui/ai`, `@revealui/mcp`, `@revealui/editors`, `@revealui/services`) are **dist-only npm installs**, not workspace packages with source code. Only `@revealui/harnesses` has a stub in `ee/packages/harnesses/`. The workspace glob `ee/packages/*` already exists in `pnpm-workspace.yaml` (line 4). Validation scripts (`scripts/validate/boundary.ts`, `scripts/validate/version-policy.ts`) already scan `ee/packages/`.

**No work needed.** This task is satisfied by current state.

---

## Task 2: Core Security Package Extraction (§4.5.11 Phase A)

**Current state:** `packages/core/src/security/` contains ~3,969 LOC across 7 modules. All exports are re-exported through `@revealui/core/security` subpath. Consumers import from `@revealui/core/security`.

**Target:** New `packages/security/` package (`@revealui/security`) with all security modules. `@revealui/core/security` becomes a thin re-export barrel for backwards compatibility.

**Dependency analysis (no circular deps):**
- `auth.ts` → `node:crypto` only
- `encryption.ts` → `node:crypto` only
- `gdpr-storage.ts` → no imports (pure types + in-memory impl)
- `gdpr.ts` → `./gdpr-storage` only
- `authorization.ts` → `@revealui/contracts`, `@revealui/utils`
- `audit.ts` → `@revealui/contracts`, `@revealui/utils`
- `headers.ts` → `../instance/logger` (defaultLogger from core) — **only cross-module dep**

**Strategy for headers.ts:** Replace the `defaultLogger` import with an optional `logger` parameter that defaults to `console`. This removes the only dependency on core internals, making the package fully independent. **Important for API consumers:** After extraction, `apps/api/` should pass its structured logger when calling `createSecurityMiddleware()` or `new SecurityHeaders()` via the config `logger` parameter. Without this, security header logs will go to `console` instead of the structured logger. This is a non-breaking change — console output is still valid — but the API app should be updated for observability.

**Build tooling note:** The `@revealui/core` package uses **`tsc`** for builds (not tsup). There is no `tsup.config.ts` in core. However, the new `@revealui/security` package will use **tsup** (like most other packages in the monorepo: contracts, utils, auth, etc.). Since the security modules are self-contained with no tsc-specific patterns (no declaration maps, no path mappings), tsup compilation is safe.

**Known test gap:** There is no `authorization.test.ts` for the RBAC/ABAC policy engine — the most complex security module. This is a pre-existing gap, not introduced by the extraction. The implementer should note this but NOT write authorization tests in this task (that's test coverage work, not extraction).

**Files to create:**
- `packages/security/package.json`
- `packages/security/tsconfig.json`
- `packages/security/tsup.config.ts`
- `packages/security/src/index.ts` (barrel — **exact copy** of core/src/security/index.ts with updated import paths)
- `packages/security/src/auth.ts` (move from core)
- `packages/security/src/authorization.ts` (move from core)
- `packages/security/src/audit.ts` (move from core)
- `packages/security/src/encryption.ts` (move from core)
- `packages/security/src/gdpr.ts` (move from core)
- `packages/security/src/gdpr-storage.ts` (move from core)
- `packages/security/src/headers.ts` (move from core, replace defaultLogger import)
- `packages/security/src/__tests__/` (move existing tests from core)

**Files to modify:**
- `packages/core/src/security/index.ts` → thin re-export from `@revealui/security`
- `packages/core/package.json` → add `@revealui/security: workspace:*` dependency

**Files that stay unchanged (backwards compat):**
- `apps/api/src/index.ts` — imports `@revealui/core/security` (still works via re-export)
- `apps/api/src/middleware/audit.ts`, `authorization.ts` — same
- `apps/api/src/routes/gdpr.ts`, `apps/api/src/lib/drizzle-gdpr-storage.ts` — same
- `packages/auth/src/server/mfa.ts` — same

**Context for implementer:**
- This is a **pure move refactor** — no behavior changes. Every test that passed before must pass after.
- The `headers.ts` logger change is the only functional modification. Replace `import { defaultLogger } from '../instance/logger.js'` with a `Logger` interface and `const defaultLogger: Logger = console`. The `SecurityHeaders` class constructor and `createSecurityMiddleware` function should accept an optional `logger` in their config.
- **Core uses `tsc` for builds, not tsup.** There is no `packages/core/tsup.config.ts`. The new security package should use tsup (read `packages/auth/tsup.config.ts` or `packages/contracts/tsup.config.ts` for the pattern).
- Existing tests are at `packages/core/src/__tests__/security/` — move them to `packages/security/src/__tests__/`.
- The `index.ts` barrel must export the **exact same symbols** as the current `packages/core/src/security/index.ts` (117 lines of explicit named exports). Any missing export would be a breaking change. Copy the file exactly and update import paths from `./auth` to `./auth.js`, etc.
- After the move, `@revealui/core/security` must still export every symbol it does today. The re-export barrel ensures zero breaking changes for consumers.

- [ ] **Step 1: Read existing patterns**

Read these files to understand build/config patterns:
- `packages/auth/tsup.config.ts` or `packages/contracts/tsup.config.ts` (tsup pattern for new package)
- `packages/core/tsconfig.json` (tsc config for reference)
- `packages/core/src/security/headers.ts` (full file — understand all logger usage)
- `packages/core/src/__tests__/security/` (all test files — list and read each)
- `packages/core/src/security/index.ts` (the exact export list to preserve)

- [ ] **Step 2: Create packages/security package scaffold**

Create `packages/security/package.json`:
```json
{
  "name": "@revealui/security",
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "biome check .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@revealui/contracts": "workspace:*",
    "@revealui/utils": "workspace:*"
  },
  "devDependencies": {
    "dev": "workspace:*",
    "tsup": "^8.5.1",
    "vitest": "^4.0.18"
  },
  "engines": {
    "node": ">=24.13.0"
  }
}
```

Create `tsconfig.json` following `packages/auth/tsconfig.json` pattern.
Create `tsup.config.ts` following `packages/auth/tsup.config.ts` pattern (single `src/index.ts` entry, ESM format, dts generation).

- [ ] **Step 3: Move security modules to packages/security/src/**

Copy all 7 source files from `packages/core/src/security/` to `packages/security/src/`:
- `auth.ts`, `authorization.ts`, `audit.ts`, `encryption.ts`, `gdpr.ts`, `gdpr-storage.ts`, `headers.ts`
- Copy `index.ts` barrel

**Critical change in headers.ts:** Replace:
```typescript
import { defaultLogger } from '../instance/logger.js';
```
With a logger interface and default:
```typescript
export interface SecurityLogger {
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

const defaultLogger: SecurityLogger = console;
```

Then find every place `defaultLogger` is used in the file and ensure the logger is configurable. If `SecurityHeaders` or `createSecurityMiddleware` accept a config object, add an optional `logger?: SecurityLogger` field. If they use `defaultLogger` directly, add it as a constructor/factory parameter.

Update all intra-module imports in `index.ts` to use `.js` extension (e.g., `./auth.js` not `./auth`).

- [ ] **Step 4: Move tests**

Copy test files from `packages/core/src/__tests__/security/` to `packages/security/src/__tests__/`. Update import paths from `../../security/...` to `../...` (since tests are now co-located).

Create test setup if needed (check if core has one the security tests depend on).

- [ ] **Step 5: Update core to re-export from @revealui/security**

Replace `packages/core/src/security/index.ts` with:
```typescript
/**
 * Security & Compliance — re-exported from @revealui/security
 *
 * This module re-exports the standalone security package for backwards compatibility.
 * New code should import directly from '@revealui/security'.
 */
export * from '@revealui/security';
```

Add `@revealui/security` to `packages/core/package.json` dependencies:
```json
"@revealui/security": "workspace:*"
```

Delete the original source files from `packages/core/src/security/` (keep only `index.ts` re-export barrel):
- Delete `auth.ts`, `authorization.ts`, `audit.ts`, `encryption.ts`, `gdpr.ts`, `gdpr-storage.ts`, `headers.ts`

Delete the security test files from `packages/core/src/__tests__/security/` (they now live in the security package).

- [ ] **Step 6: Install dependencies and build**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 && pnpm install
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 && pnpm --filter @revealui/security build
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 && pnpm --filter @revealui/core build
```

- [ ] **Step 7: Run tests and typecheck**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 && pnpm --filter @revealui/security typecheck
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 && pnpm --filter @revealui/security test
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 && pnpm --filter @revealui/core typecheck
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 && pnpm --filter api typecheck
```

Expected: all pass. The api typecheck confirms backwards-compat re-exports work.

- [ ] **Step 8: Commit**

```bash
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 add packages/security/ packages/core/src/security/ packages/core/src/__tests__/security/ packages/core/package.json
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 commit -m "refactor(core): extract security into standalone @revealui/security package (§4.5.11)"
```

---

## Task 3: Studio Desktop Polish — UI Primitives + SSH Sidebar + Panel Refactoring

**Current state:** Studio has 6 UI primitives in `apps/studio/src/components/ui/`: Button, Input, Modal, ErrorAlert, StatusDot, PanelHeader. The spec requests 6 primitives total (Button, Input, Card, Badge, Tooltip, Dialog) — **Button and Input already exist**, so we create the remaining 4.

**Pre-research finding:** `read_app_log` Rust command and log viewer **already exist** — `read_app_log` is in `apps/studio/src-tauri/src/commands/apps.rs` (line 38), registered in `lib.rs` (line 42), with a TypeScript invoke wrapper at `apps/studio/src/lib/invoke.ts` (line 162), and AppCard already has an integrated log viewer toggle. No log viewer work needed.

**Target:**
- Add 4 new UI primitives: Card, Badge, Tooltip, Dialog
- Add SSH bookmark sidebar component (Rust commands `ssh_bookmark_list`, `ssh_bookmark_save`, `ssh_bookmark_delete` already exist in `commands/ssh.rs`)
- Refactor 3 panels (AppsPanel, SyncPanel, DevBoxPanel) to use Card primitive

**Files to create:**
- `apps/studio/src/components/ui/Card.tsx`
- `apps/studio/src/components/ui/Badge.tsx`
- `apps/studio/src/components/ui/Tooltip.tsx`
- `apps/studio/src/components/ui/Dialog.tsx`
- `apps/studio/src/components/terminal/SshBookmarkSidebar.tsx`
- `apps/studio/src/__tests__/components/Card.test.tsx`
- `apps/studio/src/__tests__/components/Badge.test.tsx`
- `apps/studio/src/__tests__/components/Dialog.test.tsx`
- `apps/studio/src/__tests__/components/SshBookmarkSidebar.test.tsx`

**Files to modify:**
- `apps/studio/src/components/apps/AppsPanel.tsx` (use Card)
- `apps/studio/src/components/sync/SyncPanel.tsx` (use Card)
- `apps/studio/src/components/devbox/DevBoxPanel.tsx` (use Card)
- `apps/studio/src/components/terminal/TerminalPanel.tsx` (add SshBookmarkSidebar)

**Context for implementer:**
- Studio is a **Tauri 2 desktop app** with React 19 frontend and Rust backend.
- UI follows Studio's desktop design language: orange brand (`bg-orange-600`), neutral palette (`neutral-{200-900}`), Tailwind v4 utilities, no external UI deps.
- Existing primitives use `as const` variant maps (see `Button.tsx` for pattern).
- All Tauri commands use `StudioError` from `apps/studio/src-tauri/src/commands/error.rs` (thiserror enum with serde tag serialization).
- IPC calls use `@tauri-apps/api/core` `invoke()` — frontend mocks this in tests via `vi.mock('@tauri-apps/api/core')`.
- SSH bookmark Rust commands already exist: `ssh_bookmark_list` returns `Vec<SshBookmark>`, `ssh_bookmark_save` takes name/host/port/user/key_path, `ssh_bookmark_delete` takes name. Read `apps/studio/src-tauri/src/commands/ssh.rs` for exact signatures.
- Panel components are in subdirectories: `apps/studio/src/components/apps/`, `sync/`, `vault/`, `terminal/`, `devbox/`, etc.
- When refactoring panels to use Card, look for repeated `<div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">` patterns — that's exactly what Card replaces.

- [ ] **Step 1: Read existing patterns**

Read these files to understand UI and component patterns:
- `apps/studio/src/components/ui/Button.tsx` (variant pattern)
- `apps/studio/src/components/ui/Modal.tsx` (overlay pattern — Dialog extends this)
- `apps/studio/src/components/ui/StatusDot.tsx` (status pattern — Badge extends this)
- `apps/studio/src/components/apps/AppsPanel.tsx` (panel to refactor)
- `apps/studio/src/components/sync/SyncPanel.tsx` (panel to refactor)
- `apps/studio/src/components/devbox/DevBoxPanel.tsx` (panel to refactor)
- `apps/studio/src/components/terminal/TerminalPanel.tsx` (where sidebar will be added)
- `apps/studio/src-tauri/src/commands/ssh.rs` (bookmark command signatures)
- `apps/studio/src/lib/invoke.ts` (TypeScript invoke wrappers for SSH commands)
- `apps/studio/src/__tests__/components/Button.test.tsx` (test patterns)

- [ ] **Step 2: Create Card, Badge, Tooltip, Dialog UI primitives**

**Card.tsx** — content container with optional header, padding variants:
```typescript
const variantStyles = {
  default: 'bg-neutral-900 border border-neutral-800 rounded-lg',
  elevated: 'bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg',
  ghost: 'bg-transparent border border-neutral-800/50 rounded-lg',
} as const;

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;
```

Props: `variant`, `padding`, `header` (optional ReactNode), `children`, `className`.

**Badge.tsx** — status/label indicator:
```typescript
const variantStyles = {
  default: 'bg-neutral-800 text-neutral-300',
  success: 'bg-green-900/40 text-green-400',
  warning: 'bg-yellow-900/40 text-yellow-400',
  error: 'bg-red-900/40 text-red-400',
  info: 'bg-blue-900/40 text-blue-400',
  brand: 'bg-orange-900/40 text-orange-400',
} as const;
```

Props: `variant`, `size` (sm/md), `children`, `className`.

**Tooltip.tsx** — hover tooltip using CSS-only positioning (no Radix/Floating UI):
- Uses `group` + `group-hover:opacity-100` Tailwind pattern
- `position: 'top' | 'bottom' | 'left' | 'right'`

Props: `content` (string), `position`, `children`.

**Dialog.tsx** — extends Modal pattern with title, description, action buttons:

Props: `open`, `onClose`, `title`, `description`, `children`, `actions` (ReactNode).

Follow the exact same Tailwind patterns as Button.tsx (variant maps, `as const`, string concatenation for className).

- [ ] **Step 3: Write tests for new UI primitives**

Test each primitive renders correctly with different variants. Follow existing `Button.test.tsx` patterns (render, assert text content, check className for variant). Create:
- `Card.test.tsx` — renders default/elevated/ghost variants, renders header, renders children
- `Badge.test.tsx` — renders all 6 variants, renders sm/md sizes
- `Dialog.test.tsx` — renders when open, hides when closed, renders title/description/actions, calls onClose

- [ ] **Step 4: Create SSH Bookmark Sidebar**

Create `apps/studio/src/components/terminal/SshBookmarkSidebar.tsx`:
- Calls `invoke('ssh_bookmark_list')` on mount to load bookmarks
- Renders a vertical list of saved SSH connections (name, host, user)
- Each bookmark has a "Connect" button (calls `onSelect(bookmark)` callback) and "Delete" button
- Has an "Add Bookmark" form at the bottom (name, host, port, user, key path fields)
- Save calls `invoke('ssh_bookmark_save', { name, host, port, user, keyPath })`
- Delete calls `invoke('ssh_bookmark_delete', { name })`
- Uses Card, Input, and Button primitives

Modify `TerminalPanel.tsx` to render `<SshBookmarkSidebar />` in a collapsible side pane (CSS `w-64` sidebar with toggle).

- [ ] **Step 5: Write SSH Bookmark Sidebar test**

Create `SshBookmarkSidebar.test.tsx`:
- Renders bookmark list from mocked invoke
- "Connect" button calls onSelect with bookmark data
- "Delete" button calls invoke('ssh_bookmark_delete')
- "Add Bookmark" form saves new bookmark via invoke

- [ ] **Step 6: Refactor 3 panels to use Card primitive**

In each of `AppsPanel.tsx`, `SyncPanel.tsx`, `DevBoxPanel.tsx`:
- Find the repeated container div pattern (`<div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">` or similar)
- Replace with `<Card variant="default" padding="md">`
- Import Card from `../ui/Card`

This is a visual no-op — the same Tailwind classes, just using the shared primitive.

- [ ] **Step 7: Run tests**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 && pnpm --filter studio test
```

Expected: all pass (existing + new tests).

- [ ] **Step 8: Commit**

```bash
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 add apps/studio/
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4 commit -m "feat(studio): add UI primitives (Card, Badge, Tooltip, Dialog), SSH bookmark sidebar, panel refactoring"
```

---

## Deferred Items

The following spec items are deferred to Wave 5 or post-launch:
- **Resize debounce** — small polish item, can be done as part of Wave 5 LOW items
- **Connection status strip** — requires TerminalPanel state management changes, better suited for focused follow-up
- **Authorization tests** — pre-existing gap, tracked separately

---

## Post-Wave Verification

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-4
pnpm --filter @revealui/security typecheck && pnpm --filter @revealui/security test
pnpm --filter @revealui/core typecheck
pnpm --filter api typecheck
pnpm --filter studio test
```
