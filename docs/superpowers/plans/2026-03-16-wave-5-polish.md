# Wave 5: Polish & Marketing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up remaining LOW-priority items from the MASTER_PLAN audit.

**Architecture:** Three small independent tasks: remove React.FC from 4 CMS files, replace type assertions with type guards in hot-path API routes, and add resize debounce to Studio terminal. All other Wave 5 items are either already done or owner actions.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4

**Spec:** `docs/superpowers/specs/2026-03-16-remaining-work-execution-design.md` — Wave 5

---

## Pre-Research: Items Already Complete or Deferred

| Item | Status | Reason |
|------|--------|--------|
| §3.3 Landing page polish | **DONE** | Full marketing landing page with hero, social proof, audiences, value prop, lead capture |
| §3.4 Pro packages publish | **OWNER ACTION** | Pro packages are dist-only npm installs, not in public repo |
| R4-L2 Console.log gating | **DONE** | Docs build already uses `process.env.DEBUG` flag with pattern matching |
| R3-L16 window.confirm → modal | **DONE** | Zero `window.confirm` calls found in CMS |

---

## Task 1: Remove React.FC Usage in CMS (R4-L1)

**4 files to fix:**
- `apps/cms/src/lib/components/Media/ImageMedia/index.tsx`
- `apps/cms/src/lib/components/Media/index.tsx`
- `apps/cms/src/lib/components/PageRange/index.tsx`
- `apps/cms/src/lib/features/label/nodes/LabelNode.tsx`

**Context for implementer:**
- React 19 best practice: use plain function declarations with typed props instead of `React.FC<Props>`.
- `React.FC` implicitly adds `children` to props, which is no longer desired in React 19.
- Pattern: `const Foo: React.FC<Props> = ({ ... }) =>` → `function Foo({ ... }: Props)` or `export default function Foo({ ... }: Props)`.
- If the component uses `children`, add it explicitly to the Props interface.
- Check if the component is exported as default or named — preserve the export style.

- [ ] **Step 1: Read the 4 files and fix each**

For each file, replace `React.FC<Props>` with a plain function signature. Example:

Before:
```typescript
const ImageMedia: React.FC<ImageMediaProps> = ({ src, alt }) => { ... }
```

After:
```typescript
function ImageMedia({ src, alt }: ImageMediaProps) { ... }
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5 && pnpm --filter cms typecheck
```

- [ ] **Step 3: Commit**

```bash
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5 add apps/cms/
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5 commit -m "refactor(cms): remove React.FC usage — use plain function components (R4-L1)"
```

---

## Task 2: Type Assertions → Type Guards in API Routes (R4-L3)

**Context:** Wave 1 already created type guard helpers (`asDocument`, `asDocuments`, `asRecord`) in `apps/cms/src/lib/utils/type-guards.ts` and replaced 11 double casts in CMS. This task targets remaining `as unknown as` patterns in **API route handlers** (the hot path).

- [ ] **Step 1: Identify remaining double casts in API routes**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5
grep -rn "as unknown as" apps/api/src/routes/ --include="*.ts" | grep -v __tests__ | grep -v ".test."
```

Review each match. Focus on database query results being cast — these should use type guards. Skip test files and legitimate type narrowing.

- [ ] **Step 2: Create type guards for API if needed**

If the API doesn't already have type guard helpers, create `apps/api/src/lib/type-guards.ts` following the CMS pattern. Or import from CMS if the types are shared.

- [ ] **Step 3: Replace hot-path double casts**

Replace `someDbResult as unknown as TargetType` with proper type guard calls or Drizzle's typed queries.

- [ ] **Step 4: Typecheck and test**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5 && pnpm --filter api typecheck && pnpm --filter api test
```

- [ ] **Step 5: Commit**

```bash
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5 add apps/api/
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5 commit -m "refactor(api): replace type assertions with type guards in route handlers (R4-L3)"
```

---

## Task 3: Studio Terminal Resize Debounce

**Context:** The spec mentions "resize debounce" as a Studio polish item. The TerminalPanel component should debounce resize events to avoid excessive re-renders during window resizing.

- [ ] **Step 1: Read TerminalPanel and TerminalView**

```
apps/studio/src/components/terminal/TerminalPanel.tsx
apps/studio/src/components/terminal/TerminalView.tsx
```

Check if resize handling exists. If it does, check if it's debounced.

- [ ] **Step 2: Add debounce to resize handler**

If not already debounced, add a simple debounce (150ms) to the resize event handler using a `useRef` + `setTimeout` pattern (no lodash needed):

```typescript
const resizeTimeout = useRef<ReturnType<typeof setTimeout>>();

useEffect(() => {
  const handleResize = () => {
    clearTimeout(resizeTimeout.current);
    resizeTimeout.current = setTimeout(() => {
      // actual resize logic
    }, 150);
  };
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
    clearTimeout(resizeTimeout.current);
  };
}, []);
```

- [ ] **Step 3: Test and commit**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5 && pnpm --filter studio test
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5 add apps/studio/
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5 commit -m "perf(studio): add resize debounce to terminal panel"
```

---

## Post-Wave Verification

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-5
pnpm --filter cms typecheck
pnpm --filter api typecheck && pnpm --filter api test
pnpm --filter studio test
```
