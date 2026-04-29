/**
 * Code Validator Tests
 */

import { describe, expect, it } from 'vitest';
import type { CodeStandards } from '../types.js';
import { CodeValidator } from '../validator.js';

const testStandards: CodeStandards = {
  title: 'Test Standards',
  description: 'Test validation rules',
  version: '1.0.0',
  rules: [
    {
      id: 'no-console-log',
      name: 'No console.log',
      pattern: 'console\\.log',
      severity: 'error',
      message: 'No console.log allowed',
    },
    {
      id: 'no-any',
      name: 'No any types',
      pattern: ':\\s*any(?![\\w])',
      severity: 'warning',
      message: 'No any types',
    },
  ],
  reporting: {
    format: 'detailed',
    showContext: true,
    contextLines: 2,
  },
};

describe('CodeValidator', () => {
  it('validates clean code', () => {
    const validator = new CodeValidator(testStandards);
    const code = `
      function foo() {
        return 'hello'
      }
    `;

    const result = validator.validate(code);

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it('detects console.log violations', () => {
    const validator = new CodeValidator(testStandards);
    const code = `
      function foo() {
        console.log('debug')
        return 'hello'
      }
    `;

    const result = validator.validate(code);

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.ruleId).toBe('no-console-log');
    expect(result.violations[0]?.severity).toBe('error');
    expect(result.errors).toBe(1);
  });

  it('detects any type violations', () => {
    const validator = new CodeValidator(testStandards);
    const code = `
      function foo(data: any) {
        return data
      }
    `;

    const result = validator.validate(code);

    expect(result.valid).toBe(true); // warnings don't make it invalid
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.ruleId).toBe('no-any');
    expect(result.violations[0]?.severity).toBe('warning');
    expect(result.warnings).toBe(1);
  });

  it('respects path exemptions', () => {
    const rule0 = testStandards.rules[0];
    if (!rule0) throw new Error('Rule 0 not found');

    const standardsWithExemptions: CodeStandards = {
      ...testStandards,
      rules: [
        {
          ...rule0,
          exemptions: {
            paths: ['**/*.test.ts'],
          },
        },
      ],
    };

    const validator = new CodeValidator(standardsWithExemptions);
    const code = `console.log('test')`;

    const result = validator.validate(code, { filePath: 'src/foo.test.ts' });

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.stats.exemptionsApplied).toBe(1);
  });

  it('respects path exemptions through dot-prefixed segments (worktree paths)', () => {
    // Regression: git worktrees live under `.wt/<name>/...`, so absolute
    // paths passed by `scripts/validation/validate-code.ts` from a worktree
    // contain a `.wt/` segment. minimatch's default behavior refuses to
    // traverse dot-prefixed segments under `**`, so without `{ dot: true }`
    // every exemption pattern fails for worktree-resolved paths. This test
    // pins that fix in place. (Discovered 2026-04-29 during CHIP-3 Phase 3.)
    const rule0 = testStandards.rules[0];
    if (!rule0) throw new Error('Rule 0 not found');

    const standardsWithExemptions: CodeStandards = {
      ...testStandards,
      rules: [
        {
          ...rule0,
          exemptions: {
            paths: ['**/vite.config*.ts'],
          },
        },
      ],
    };

    const validator = new CodeValidator(standardsWithExemptions);
    const code = `console.log('test')`;

    // Absolute path with .wt/ segment (the worktree case)
    const wtResult = validator.validate(code, {
      filePath: '/home/dev/suite/.wt/feature-branch/apps/docs/vite.config.ts',
    });
    expect(wtResult.valid).toBe(true);
    expect(wtResult.violations).toHaveLength(0);
    expect(wtResult.stats.exemptionsApplied).toBe(1);

    // Also verify .git/, .next/, and .husky/ segments don't defeat matching
    const gitResult = validator.validate(code, {
      filePath: '/repo/.git/hooks/vite.config.ts',
    });
    expect(gitResult.stats.exemptionsApplied).toBe(1);

    const nextResult = validator.validate(code, {
      filePath: 'apps/admin/.next/cache/vite.config.ts',
    });
    expect(nextResult.stats.exemptionsApplied).toBe(1);
  });

  it('respects comment exemptions', () => {
    const rule0 = testStandards.rules[0];
    if (!rule0) throw new Error('Rule 0 not found');

    const standardsWithExemptions: CodeStandards = {
      ...testStandards,
      rules: [
        {
          ...rule0,
          exemptions: {
            comments: ['ai-validator-ignore'],
          },
        },
      ],
    };

    const validator = new CodeValidator(standardsWithExemptions);
    const code = `
      console.log('normal') // This should fail
      console.log('ignored') // ai-validator-ignore
    `;

    const result = validator.validate(code);

    expect(result.violations).toHaveLength(1); // Only first console.log
    expect(result.violations[0]?.line).toBe(2);
  });

  it('formats results correctly', () => {
    const validator = new CodeValidator(testStandards);
    const code = `console.log('test')`;

    const result = validator.validate(code);
    const formatted = validator.formatResult(result, { colors: false });

    expect(formatted).toContain('✗ Code violations found');
    expect(formatted).toContain('ERROR [no-console-log]');
    expect(formatted).toContain('1 errors, 0 warnings');
  });

  it('auto-fixes violations', () => {
    const standardsWithAutoFix: CodeStandards = {
      ...testStandards,
      autoFix: {
        enabled: true,
        rules: [
          {
            id: 'no-console-log',
            find: 'console\\.log\\(([^)]*)\\)',
            replace: '// FIXME: logger.info($1)',
          },
        ],
      },
    };

    const validator = new CodeValidator(standardsWithAutoFix);
    const code = `console.log('test')`;

    const { code: fixedCode, fixesApplied } = validator.autoFix(code);

    expect(fixesApplied).toBe(1);
    expect(fixedCode).toBe(`// FIXME: logger.info('test')`);
  });

  it('provides context lines', () => {
    const validator = new CodeValidator(testStandards);
    const code = `
      function foo() {
        const x = 1
        console.log(x)
        return x
      }
    `;

    const result = validator.validate(code);

    expect(result.violations[0]?.context).toBeDefined();
    expect(result.violations[0]?.context?.length).toBeGreaterThan(0);
    expect(result.violations[0]?.context?.some((line) => line.includes('>'))).toBe(true);
  });

  it('counts stats correctly', () => {
    const validator = new CodeValidator(testStandards);
    const code = `
      console.log('one')
      console.log('two')
      const foo: any = {}
    `;

    const result = validator.validate(code);

    expect(result.stats.linesScanned).toBe(5);
    expect(result.stats.rulesApplied).toBe(2);
    expect(result.violations).toHaveLength(3); // 2 console.log + 1 any
  });
});
