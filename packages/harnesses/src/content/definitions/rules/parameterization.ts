import type { Rule } from '../../schemas/rule.js';

export const parameterizationRule: Rule = {
  id: 'parameterization',
  tier: 'oss',
  name: 'Parameterization Conventions',
  description: 'Never hardcode config values — extract, type, default, and make overridable',
  scope: 'project',
  preambleTier: 2,
  tags: ['config', 'patterns'],
  content: `# Parameterization Conventions

## Core Rule

**Never hardcode configuration values inline.** All tunable constants (TTLs, limits, lengths, thresholds, intervals) must be:

1. **Extracted** into a named config object or constant at module scope
2. **Typed** with an explicit interface
3. **Defaulted** with sensible production values
4. **Overridable** via an exported \`configure*()\` function or constructor parameter

## Pattern

\`\`\`ts
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
\`\`\`

## Why

- Tests need fast TTLs and small limits
- Deployments may need different thresholds than development
- \`Math.random()\` is not cryptographically secure — use \`crypto.randomInt()\` for security-sensitive values (OTPs, tokens, nonces)

## Applies To

- Rate limit windows and thresholds
- Cache TTLs and max sizes
- OTP/token lengths and expiry times
- Retry counts and backoff intervals
- Batch sizes and concurrency limits

## Does NOT Apply To

- Structural constants (HTTP status codes, header names, URL paths)
- Type discriminants and enum values
- Schema definitions (use contracts)`,
};
