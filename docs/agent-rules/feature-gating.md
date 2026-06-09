---
title: "Feature Gating Conventions"
description: "Rules for managing Pro/OSS tier boundaries in the RevealUI monorepo."
visibility: internal
status: verified
audience: agent
---

Rules for managing Pro/OSS tier boundaries in the RevealUI monorepo.

## Tier Model

| Tier | Code String | Distribution |
|------|-------------|-------------|
| Free | `'free'` | MIT, open source |
| Pro | `'pro'` | Fair Source (FSL-1.1-MIT), converts to MIT after 2 years |
| Max | `'max'` | Extended Pro features |
| Enterprise | `'enterprise'` | White-label (planned), multi-tenant, self-hosted |

## Runtime Checks

```ts
import { isLicensed, isFeatureEnabled } from '@revealui/core'

// Check tier access
if (isLicensed('pro')) {
  // Pro+ feature
}

// Check specific feature flag
if (isFeatureEnabled('ai')) {
  // AI feature (requires Pro)
}
```

## Package Boundaries

### OSS Packages (MIT)
- `@revealui/core`, `@revealui/contracts`, `@revealui/db`, `@revealui/auth`
- `@revealui/presentation`, `@revealui/router`, `@revealui/config`, `@revealui/utils`
- `@revealui/cli`, `@revealui/setup`, `@revealui/sync`, `@revealui/dev`, `@revealui/test`
- `@revealui/cache`, `@revealui/resilience`, `@revealui/security`, `@revealui/openapi`, `@revealui/paywall`

### Pro Packages (Commercial — FSL-1.1-MIT)
- `@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`
- `@revealui/mcp`, `@revealui/services`

> Editor config sync ships as [**RevCon**](https://github.com/RevealUIStudio/revcon), a separate fleet repo — not gated by Pro, not in this monorepo.

## Rules

1. OSS packages must never import from Pro packages
2. Pro packages may import from OSS packages
3. Public tests must not hard-require Pro package source paths
4. Pro-only test suites go in separate config/directories
5. Feature gates use `isLicensed()` / `isFeatureEnabled()`, not environment variables
