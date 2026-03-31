---
name: revealui-review
description: |
  Code review checklist for RevealUI. Use when reviewing code, completing a feature,
  checking quality, or before committing. Invoke explicitly with $revealui-review.
disable-model-invocation: true
---

# RevealUI Code Review

Run this checklist before committing or claiming work is complete.

## Automated Checks

Run each command and confirm clean output:

```bash
# 1. Biome lint + format
pnpm lint

# 2. TypeScript — all packages
pnpm typecheck:all

# 3. Tests — affected packages
pnpm --filter <package> test

# 4. Quick gate (lint + typecheck + structure)
pnpm gate:quick
```

## Manual Checks

### Type Safety
- [ ] No `any` types (use `unknown` + type guards)
- [ ] No `as` casts where `satisfies` works
- [ ] Exported functions have explicit return types
- [ ] `import type` used for type-only imports

### Code Quality
- [ ] No `console.*` in production code (use `@revealui/utils` logger)
- [ ] No hardcoded config values (use parameterization pattern)
- [ ] No unused variables/imports (follow decision tree if flagged)
- [ ] Single responsibility — each file does one thing

### Architecture
- [ ] No Supabase imports outside permitted paths
- [ ] No cross-package relative imports (use `@revealui/<name>`)
- [ ] Internal deps use `workspace:*`
- [ ] OSS packages don't import from Pro packages

### Tailwind v4
- [ ] `bg-(--var)` not `bg-[--var]` for CSS variables
- [ ] `bg-red-500!` not `!bg-red-500` for important
- [ ] `@import "tailwindcss"` not `@tailwind`
- [ ] `@utility` not `@layer utilities`
- [ ] `gap` preferred over `space-*`

### Git
- [ ] Conventional commit: `type(scope): description`
- [ ] Subject under 72 characters, imperative mood
- [ ] Identity: RevealUI Studio <founder@revealui.com>
- [ ] No secrets in committed files
