import type { Rule } from '../../schemas/rule.js';

export const codeAnalysisPolicyRule: Rule = {
  id: 'code-analysis-policy',
  tier: 'oss',
  name: 'Code Analysis Policy',
  description: 'Prefer AST-based analysis over regex for security and architecture checks',
  scope: 'project',
  preambleTier: 3,
  tags: ['security', 'analysis'],
  content: `# Code Analysis Policy

Use AST-based or structural analysis for code-policy and security checks whenever the rule depends on syntax, identifiers, or code shape.

## Prefer AST-Based Analysis For

- security gate checks over application code
- architecture and boundary rules
- auth/password handling checks
- response/body serialization checks
- import-policy enforcement beyond simple path inventory

## Regex Is Acceptable Only For

- broad inventory scans over raw text
- committed secret patterns
- literal token/URL/key detection
- quick warning-level heuristics that are explicitly marked approximate

## Do Not Use Regex As Source Of Truth For

- whether a value is stored in plaintext
- whether a secret is hardcoded in executable code
- whether a boundary rule is violated by code structure
- whether a security-sensitive value reaches a sink

## Working Rule

If a check can be expressed against the TypeScript/JavaScript AST with reasonable effort, use AST analysis first.

If regex is still used:

- document it as heuristic-only
- keep it warning-level unless independently verified
- add a follow-up to migrate it to AST/structural analysis`,
};
