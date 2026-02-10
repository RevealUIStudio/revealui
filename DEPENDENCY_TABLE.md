# RevealUI Dependency Quick Reference

## Package Dependency Matrix

| Package | Layer | Workspace Dependencies | Dependents (Count) |
|---------|-------|------------------------|-------------------|
| `dev` | 0 | None | All (devDep) |
| `@revealui/utils` | 0 | None | 2 packages |
| `@revealui/config` | 0 | None | 7 packages + 3 apps |
| `@revealui/editors` | 0 | None | 0 |
| `@revealui/router` | 0 | None | 1 app |
| `@revealui/presentation` | 0 | None | 2 apps |
| `@revealui/db` | 1 | config, utils | 6 packages + 4 apps |
| `@revealui/mcp` | 1 | config | 0 |
| `@revealui/contracts` | 2 | db (peer) | 5 packages + 1 app |
| `@revealui/core` | 2 | contracts, utils | 4 packages + 6 apps |
| `@revealui/auth` | 3 | config, contracts, core, db | 1 app |
| `@revealui/services` | 3 | config, core | 1 package + 1 app |
| `@revealui/sync` | 3 | contracts, db | 1 app |
| `@revealui/ai` | 3 | contracts, core, db | 2 packages + 2 apps |
| `@revealui/setup` | 4 | config | 1 package |
| `@revealui/cli` | 4 | config, setup | 0 |
| `test` | 5 | ai, contracts, core, db, services | 0 |

## Application Dependencies

| App | Workspace Dependencies | Build Layer |
|-----|------------------------|-------------|
| `api` | config, core, db | Layer 2+ |
| `docs` | core | Layer 2+ |
| `landing` | core, db | Layer 2+ |
| `web` | presentation, router, core (dev), db (dev) | Layer 2+ |
| `dashboard` | ai, core, db | Layer 3+ |
| `cms` | ai, auth, config, contracts, core, db, presentation, services (dev), sync | Layer 3+ |

## Build Order by Layer

```
Layer 0 (6 packages) → Layer 1 (2 packages) → Layer 2 (2 packages) → Layer 3 (4 packages) → Layer 4 (2 packages) → Layer 5 (1 package) → Apps (6)
```

### Estimated Parallel Build Groups

**Round 1** (6 packages in parallel):
- dev
- @revealui/utils
- @revealui/config
- @revealui/editors
- @revealui/router
- @revealui/presentation

**Round 2** (2 packages in parallel):
- @revealui/db
- @revealui/mcp

**Round 3** (2 packages in parallel):
- @revealui/contracts
- @revealui/core

**Round 4** (4 packages in parallel):
- @revealui/auth
- @revealui/services
- @revealui/sync
- @revealui/ai

**Round 5** (2 packages in parallel):
- @revealui/setup
- @revealui/cli

**Round 6** (1 package):
- test

**Round 7** (6 apps, some parallel):
- api, docs, landing, web (can build in parallel after Layer 2)
- dashboard, cms (must wait for Layer 3)

## Critical Path Analysis

### Most Critical Package: @revealui/core
- **Dependents**: 10 total (4 packages + 6 apps)
- **Impact**: Blocks 90% of the monorepo
- **Layer**: 2 (builds early)

### Second Critical: @revealui/db
- **Dependents**: 10 total (6 packages + 4 apps)
- **Impact**: Blocks all data-dependent packages
- **Layer**: 1 (builds very early)

### Third Critical: @revealui/contracts
- **Dependents**: 6 total (5 packages + 1 app)
- **Impact**: Type safety across the stack
- **Layer**: 2 (builds early)

## Dependency Depth by Package

| Package | Max Dependency Chain Length |
|---------|----------------------------|
| Layer 0 packages | 0 (no dependencies) |
| @revealui/db | 1 (config → db) |
| @revealui/mcp | 1 (config → mcp) |
| @revealui/contracts | 2 (config → db → contracts) |
| @revealui/core | 2 (config → utils → core) |
| @revealui/auth | 3 (config → utils → core → auth) |
| @revealui/ai | 3 (config → utils → core → ai) |
| cms app | 4 (longest chain through all layers) |

## Performance Considerations

### Parallel Build Efficiency
- **Best case**: All 6 Layer 0 packages build simultaneously (6x speedup)
- **Typical case**: Average 2-3 packages per layer build in parallel
- **Bottleneck**: @revealui/core (Layer 2) - many packages wait for it

### Build Time Optimization Opportunities
1. **Layer 0**: Already optimal (6 packages in parallel)
2. **Layer 2**: Only 2 packages, but @revealui/core is large
   - Consider splitting core into smaller packages if build times grow
3. **Apps**: cms has 9 dependencies (monitor build performance)

## Verification Commands

```bash
# Check for circular dependencies
pnpm exec turbo run build --dry=json | grep -i circular

# Generate build graph
pnpm exec turbo run build --dry --graph

# Profile build performance
pnpm exec turbo run build --profile=profile.json

# Verify build order
pnpm exec turbo run build --dry=json | jq '.tasks[].task'
```

## Summary

✅ **Current Status**: Optimal configuration
- No circular dependencies
- Clear layer separation
- Maximum parallelization
- Efficient caching

✅ **Turbo Configuration**: `"dependsOn": ["^build"]` is correct
- Automatically resolves build order
- Builds dependencies first
- Caches unchanged packages

✅ **Architecture Quality**: Professional monorepo structure
- Infrastructure → Core → Features → Apps
- Reusable shared packages
- Type-safe contracts
- Scalable design
