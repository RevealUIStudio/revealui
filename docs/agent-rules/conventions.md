# Coding Conventions

Standards for TypeScript, git, and configuration in the RevealUI monorepo.

## TypeScript

- Always use strict mode (`strict: true` in tsconfig)
- Use ES Modules (`import`/`export`), never CommonJS (`require`)
- Prefer `interface` over `type` for object shapes (unless union/intersection needed)
- Use explicit return types on exported functions
- Avoid `any`  -  use `unknown` and narrow with type guards
- Use `as const` for literal objects and arrays when appropriate
- Prefer `satisfies` over `as` for type assertions when possible
- Use optional chaining (`?.`) and nullish coalescing (`??`) over manual checks
- Async/await over `.then()` chains

## Git

### Commit Messages
- Use conventional commits: `type(scope): description`
- Types: feat, fix, refactor, docs, test, chore, ci, perf
- Scope is optional, use package name for monorepos (e.g., `feat(core): add parser`)
- Description in imperative mood, lowercase, no period
- Keep subject line under 72 characters

### Branch Naming
- Feature: `feat/<short-description>`
- Bugfix: `fix/<short-description>`
- Chore: `chore/<short-description>`

### Identity
- Professional repos (RevealUIStudio): RevealUI Studio <founder@revealui.com>

## Parameterization

### Core Rule

**Never hardcode configuration values inline.** All tunable constants (TTLs, limits, lengths, thresholds, intervals) must be:

1. **Extracted** into a named config object or constant at module scope
2. **Typed** with an explicit interface
3. **Defaulted** with sensible production values
4. **Overridable** via an exported `configure*()` function or constructor parameter

### Pattern

```ts
export interface ModuleConfig {
  /** TTL in milliseconds (default: 5 minutes) */
  ttlMs: number
  /** Max entries before forced cleanup (default: 10_000) */
  maxEntries: number
}

const DEFAULT_CONFIG: ModuleConfig = {
  ttlMs: 5 * 60 * 1000,
  maxEntries: 10_000,
}

let config: ModuleConfig = { ...DEFAULT_CONFIG }

export function configureModule(overrides: Partial<ModuleConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides }
}
```

### Why

- Tests need fast TTLs and small limits
- Deployments may need different thresholds than development
- `Math.random()` is not cryptographically secure  -  use `crypto.randomInt()` for security-sensitive values (OTPs, tokens, nonces)

### Applies To

- Rate limit windows and thresholds
- Cache TTLs and max sizes
- OTP/token lengths and expiry times
- Retry counts and backoff intervals
- Batch sizes and concurrency limits

### Does NOT Apply To

- Structural constants (HTTP status codes, header names, URL paths)
- Type discriminants and enum values
- Schema definitions (use contracts)
