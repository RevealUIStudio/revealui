# Wave 3: Test Coverage Sprint Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase test coverage across Studio (→70%), Marketing (→50%), and Docs (→40%) apps by adding tests for untested components, hooks, and utilities.

**Architecture:** Each task targets one app. Tests are co-located with source (Studio: `src/__tests__/`, Marketing/Docs: co-located `*.test.ts`). All use Vitest + jsdom (Studio/Docs) or node (Marketing). Focus on highest-impact untested paths first.

**Tech Stack:** TypeScript 5.9, Vitest 4, @testing-library/react, jsdom

**Spec:** `docs/superpowers/specs/2026-03-16-remaining-work-execution-design.md` — Wave 3

---

## Task 1: Studio Test Coverage (Target: 70%)

**Current:** 13 test files (5 components, 8 hooks). ~35% coverage.
**Target:** Add tests for deploy wizard steps, dashboard panels, missing hooks, and key UI primitives.

**Files to create:**
- `apps/studio/src/__tests__/components/DeployWizard.test.tsx`
- `apps/studio/src/__tests__/components/AppCard.test.tsx`
- `apps/studio/src/__tests__/components/VaultPanel.test.tsx`
- `apps/studio/src/__tests__/components/SyncPanel.test.tsx`
- `apps/studio/src/__tests__/components/TerminalPanel.test.tsx`
- `apps/studio/src/__tests__/components/IntentScreen.test.tsx`
- `apps/studio/src/__tests__/components/SetupWizard.test.tsx`
- `apps/studio/src/__tests__/hooks/use-config.test.ts`
- `apps/studio/src/__tests__/hooks/use-deploy-wizard.test.ts`

**Context for implementer:**
- Studio is a Tauri desktop app. IPC calls use `@tauri-apps/api/core` `invoke()` — mock this globally.
- Existing tests mock Tauri invoke via `vi.mock('@tauri-apps/api/core')`.
- Test setup file exists at `apps/studio/src/__tests__/setup.ts`.
- Components use React hooks that call Tauri commands. Test the render output and state transitions, not IPC internals.
- Deploy wizard has 11 step components — test the main `DeployWizard` orchestrator and 2-3 representative steps, not all 11.
- Read existing test files (e.g., `Button.test.tsx`, `use-apps.test.ts`) to understand patterns before writing.

- [ ] **Step 1: Read existing test patterns and component source**
- [ ] **Step 2: Write tests for deploy wizard (orchestrator + 2 steps)**
- [ ] **Step 3: Write tests for key panels (AppCard, VaultPanel, SyncPanel, TerminalPanel)**
- [ ] **Step 4: Write tests for IntentScreen and SetupWizard**
- [ ] **Step 5: Write tests for use-config and use-deploy-wizard hooks**
- [ ] **Step 6: Run tests** — `cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-3 && pnpm --filter studio test`
- [ ] **Step 7: Commit** — `git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-3 commit -m "test(studio): add tests for deploy wizard, panels, and hooks (Wave 3)"`

---

## Task 2: Marketing Test Coverage (Target: 50%)

**Current:** 3 test files (2 API routes, 1 pricing data). 0 component tests. ~15% coverage.
**Target:** Add component tests for hero section, footer, navbar, signup flow.

**Files to create:**
- `apps/marketing/src/__tests__/components/HeroSection.test.tsx`
- `apps/marketing/src/__tests__/components/Footer.test.tsx`
- `apps/marketing/src/__tests__/components/NavBar.test.tsx`
- `apps/marketing/src/__tests__/components/ValueProposition.test.tsx`

**Context for implementer:**
- Marketing is a Next.js app. Components are server components by default.
- Test with `@testing-library/react` for client components, or test render output directly for server components.
- Read existing test patterns (health.test.ts, waitlist.test.ts) first.
- Check if components use `'use client'` directive — only client components can use React Testing Library.
- If components are server components, test their exported functions or rendered HTML structure.

- [ ] **Step 1: Read existing patterns and identify client vs server components**
- [ ] **Step 2: Write component tests for HeroSection, Footer, NavBar, ValueProposition**
- [ ] **Step 3: Run tests** — `cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-3 && pnpm --filter marketing test`
- [ ] **Step 4: Commit** — `git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-3 commit -m "test(marketing): add component tests for landing page (Wave 3)"`

---

## Task 3: Docs Test Coverage (Target: 40%)

**Current:** 3 test files (1 component, 2 utilities). ~20% coverage.
**Target:** Add tests for LicenseGate, SearchBar, DocLayout.

**Files to create:**
- `apps/docs/src/__tests__/LicenseGate.test.tsx`
- `apps/docs/src/__tests__/SearchBar.test.tsx`
- `apps/docs/src/__tests__/DocLayout.test.tsx`

**Context for implementer:**
- Docs is a Vite + React SPA. All components are client-side.
- LicenseGate wraps Pro content with license key validation — test that it shows/hides content based on license state.
- Check for `useLicenseKey` hook or similar pattern.
- Existing test setup at `apps/docs/src/__tests__/setup.ts`.

- [ ] **Step 1: Read existing patterns and component source**
- [ ] **Step 2: Write tests for LicenseGate, SearchBar, DocLayout**
- [ ] **Step 3: Run tests** — `cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-3 && pnpm --filter docs test`
- [ ] **Step 4: Commit** — `git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-3 commit -m "test(docs): add component tests for license gate, search, and layout (Wave 3)"`

---

## Post-Wave Verification

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-3
pnpm --filter studio test
pnpm --filter marketing test
pnpm --filter docs test
```
