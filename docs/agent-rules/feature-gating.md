# Feature Gating Conventions

Rules for managing Pro/OSS tier boundaries in the RevealUI monorepo.

## Tier Model

| Tier | Code String | Distribution |
|------|-------------|-------------|
| Free | `'free'` | MIT, open source |
| Pro | `'pro'` | Source-available, commercially licensed |
| Max | `'max'` | Extended Pro features |
| Enterprise (Forge) | `'enterprise'` | White-label (planned), multi-tenant, self-hosted |

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

### Pro Packages (Commercial)
- `@revealui/ai`, `@revealui/mcp`, `@revealui/editors`
- `@revealui/services`, `@revealui/harnesses`

## Rules

1. OSS packages must never import from Pro packages
2. Pro packages may import from OSS packages
3. Public tests must not hard-require Pro package source paths
4. Pro-only test suites go in separate config/directories
5. Feature gates use `isLicensed()` / `isFeatureEnabled()`, not environment variables
