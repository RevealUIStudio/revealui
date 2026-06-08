import { existsSync, readFileSync } from 'node:fs';
import { literalIncludes } from './predicates';
import type { Rule } from './rules';

/** Thrown on a malformed repo-local rules file so the CLI can exit 2 (setup error). */
export class ConfigError extends Error {}

interface RawRule {
  readonly tag?: unknown;
  readonly reason?: unknown;
  readonly literal?: unknown;
  readonly anyOf?: unknown;
}

/**
 * Load repo-local SENSITIVE rules from a JSON file (default `.leakrules.json`).
 * These are the literal values that must NOT live in the shipped bundle —
 * internal hostname, customer / prospect / person names, operator bank, etc.
 *
 * Format: a JSON array of `{ tag, reason, (literal | anyOf) }`. `literal` is a
 * single substring; `anyOf` is a list of substrings (match any) — e.g. the two
 * case forms of a name. Structured-token rules are all generic and live in
 * BASE; repo-local rules are literal-only, which keeps them JSON-expressible.
 *
 * Missing file => no local rules. Malformed file => ConfigError (fail loud).
 */
export function loadLocalRules(path: string): Rule[] {
  if (!existsSync(path)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new ConfigError(`leak-scan: invalid JSON in ${path}: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new ConfigError(`leak-scan: ${path} must be a JSON array of rules`);
  }
  return parsed.map((raw, index) => toRule(raw as RawRule, index, path));
}

function toRule(raw: RawRule, index: number, path: string): Rule {
  const where = `${path}[${index}]`;
  if (typeof raw.tag !== 'string' || raw.tag === '') {
    throw new ConfigError(`${where}: "tag" must be a non-empty string`);
  }
  if (typeof raw.reason !== 'string' || raw.reason === '') {
    throw new ConfigError(`${where}: "reason" must be a non-empty string`);
  }
  const hasLiteral = typeof raw.literal === 'string';
  const hasAnyOf = Array.isArray(raw.anyOf);
  if (hasLiteral === hasAnyOf) {
    throw new ConfigError(
      `${where}: provide exactly one of "literal" (string) or "anyOf" (string[])`,
    );
  }
  const { tag, reason } = raw;
  if (hasLiteral) {
    const value = raw.literal as string;
    if (value === '') throw new ConfigError(`${where}: "literal" must be non-empty`);
    return { tag, reason, matches: (line) => literalIncludes(line, value) };
  }
  const values = (raw.anyOf as unknown[]).map((v, j) => {
    if (typeof v !== 'string' || v === '') {
      throw new ConfigError(`${where}.anyOf[${j}]: each entry must be a non-empty string`);
    }
    return v;
  });
  if (values.length === 0) throw new ConfigError(`${where}: "anyOf" must list at least one string`);
  return { tag, reason, matches: (line) => values.some((v) => literalIncludes(line, v)) };
}
