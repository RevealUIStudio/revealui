import { describe, expect, it } from 'vitest';
import {
  EXEC_SYNC_STRING_RULE,
  IssueLocationSchema,
  REDOS_REGEX_RULE,
  RetCharSchema,
  RetNodeType,
  RetRangeSchema,
  RetRootSchema,
  RetSetSchema,
  SECURITY_RULES,
  SecurityFindingSchema,
  SecurityRuleSchema,
  TOCTOU_STAT_READ_RULE,
} from '../security/index.js';

describe('ret AST schemas', () => {
  it('validates a Char node', () => {
    const result = RetCharSchema.safeParse({ type: RetNodeType.CHAR, value: 65 });
    expect(result.success).toBe(true);
  });

  it('validates a Range node', () => {
    const result = RetRangeSchema.safeParse({ type: RetNodeType.RANGE, from: 48, to: 57 });
    expect(result.success).toBe(true);
  });

  it('validates a Set node with char and range members', () => {
    const result = RetSetSchema.safeParse({
      type: RetNodeType.SET,
      set: [
        { type: RetNodeType.RANGE, from: 97, to: 122 },
        { type: RetNodeType.CHAR, value: 45 },
      ],
      not: false,
    });
    expect(result.success).toBe(true);
  });

  it('validates a negated Set node', () => {
    const result = RetSetSchema.safeParse({
      type: RetNodeType.SET,
      set: [{ type: RetNodeType.CHAR, value: 34 }],
      not: true,
    });
    expect(result.success).toBe(true);
  });

  it('validates a Root node with stack', () => {
    const result = RetRootSchema.safeParse({
      type: RetNodeType.ROOT,
      stack: [
        { type: RetNodeType.CHAR, value: 97 },
        {
          type: RetNodeType.REPETITION,
          min: 1,
          max: Infinity,
          value: { type: RetNodeType.CHAR, value: 98 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type values', () => {
    const result = RetCharSchema.safeParse({ type: 99, value: 65 });
    expect(result.success).toBe(false);
  });
});

describe('security rule schemas', () => {
  it('validates a well-formed rule', () => {
    const result = SecurityRuleSchema.safeParse(EXEC_SYNC_STRING_RULE);
    expect(result.success).toBe(true);
  });

  it('validates all built-in rules', () => {
    for (const rule of Object.values(SECURITY_RULES)) {
      const result = SecurityRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
    }
  });

  it('rejects rule with invalid id format', () => {
    const result = SecurityRuleSchema.safeParse({
      ...EXEC_SYNC_STRING_RULE,
      id: 'UPPERCASE-BAD',
    });
    expect(result.success).toBe(false);
  });

  it('rejects rule with missing title', () => {
    const { title: _, ...noTitle } = EXEC_SYNC_STRING_RULE;
    const result = SecurityRuleSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it('contains all expected rule IDs', () => {
    expect(Object.keys(SECURITY_RULES)).toEqual(
      expect.arrayContaining(['exec-sync-string', 'toctou-stat-read', 'redos-regex']),
    );
  });

  it('each rule has a CWE', () => {
    for (const rule of Object.values(SECURITY_RULES)) {
      expect(rule.cwe).toMatch(/^CWE-\d+$/);
    }
  });
});

describe('security finding schema', () => {
  it('validates a complete finding', () => {
    const result = SecurityFindingSchema.safeParse({
      rule: REDOS_REGEX_RULE,
      location: {
        file: 'packages/core/src/parser.ts',
        line: 42,
        column: 5,
        snippet: 'const re = /(a+)+$/;',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects finding with invalid location', () => {
    const result = SecurityFindingSchema.safeParse({
      rule: TOCTOU_STAT_READ_RULE,
      location: {
        file: '',
        line: -1,
        column: 0,
        snippet: '',
      },
    });
    expect(result.success).toBe(false);
  });

  it('validates issue location independently', () => {
    const result = IssueLocationSchema.safeParse({
      file: 'src/index.ts',
      line: 10,
      column: 1,
      snippet: 'const x = 1;',
    });
    expect(result.success).toBe(true);
  });
});
