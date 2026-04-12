/**
 * Built-in Security Rule Definitions
 *
 * Adding a new rule: define a constant here, add it to SECURITY_RULES,
 * then implement detection in @revealui/scripts/analyzers.
 */

import type { SecurityRule } from './rules.js';

// =============================================================================
// Rule Definitions
// =============================================================================

export const EXEC_SYNC_STRING_RULE: SecurityRule = {
  id: 'exec-sync-string',
  title: 'execSync with string interpolation',
  description:
    'Detects execSync calls where the command is built via template literal or string concatenation, risking command injection.',
  severity: 'warning',
  category: 'injection',
  cwe: 'CWE-78',
  remediation: 'Use execFileSync with an args array instead of building command strings.',
};

export const TOCTOU_STAT_READ_RULE: SecurityRule = {
  id: 'toctou-stat-read',
  title: 'stat then read on same path (TOCTOU)',
  description:
    'Detects statSync/lstatSync followed by readFileSync on the same path in the same scope. The file can change between the two calls.',
  severity: 'warning',
  category: 'race-condition',
  cwe: 'CWE-367',
  remediation: 'Use readFileSync inside a try/catch instead of checking with stat first.',
};

export const REDOS_REGEX_RULE: SecurityRule = {
  id: 'redos-regex',
  title: 'Catastrophic backtracking regex (ReDoS)',
  description:
    'Detects regex patterns with nested quantifiers and overlapping character sets that can cause exponential backtracking.',
  severity: 'warning',
  category: 'denial-of-service',
  cwe: 'CWE-1333',
  remediation:
    'Restructure the regex to avoid nested quantifiers with overlapping character sets, or use a linear-time regex engine.',
};

// =============================================================================
// Registry
// =============================================================================

export const SECURITY_RULES = {
  'exec-sync-string': EXEC_SYNC_STRING_RULE,
  'toctou-stat-read': TOCTOU_STAT_READ_RULE,
  'redos-regex': REDOS_REGEX_RULE,
} as const satisfies Record<string, SecurityRule>;

export type SecurityRuleId = keyof typeof SECURITY_RULES;
