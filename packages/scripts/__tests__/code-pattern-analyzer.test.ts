import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findCodePatternIssues } from '../analyzers/code-pattern-analyzer.js';

function createProjectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'revealui-code-pattern-'));
  mkdirSync(join(root, 'apps'), { recursive: true });
  mkdirSync(join(root, 'packages'), { recursive: true });
  return root;
}

function writeSourceFile(projectRoot: string, relativePath: string, content: string): void {
  const fullPath = join(projectRoot, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
}

const projectRoots: string[] = [];

afterEach(() => {
  for (const projectRoot of projectRoots.splice(0)) {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

describe('findCodePatternIssues', () => {
  describe('execSync with string interpolation', () => {
    it('flags execSync with template literal', () => {
      const root = createProjectRoot();
      projectRoots.push(root);

      writeSourceFile(
        root,
        'packages/demo/src/runner.ts',
        `
        import { execSync } from 'node:child_process';
        function run(cmd: string) {
          return execSync(\`git \${cmd}\`, { encoding: 'utf8' });
        }
        `,
      );

      const issues = findCodePatternIssues(root);
      expect(issues.some((i) => i.kind === 'exec-sync-string')).toBe(true);
    });

    it('flags execSync with string concatenation', () => {
      const root = createProjectRoot();
      projectRoots.push(root);

      writeSourceFile(
        root,
        'packages/demo/src/runner.ts',
        `
        import { execSync } from 'node:child_process';
        function run(file: string) {
          return execSync("cat " + file, { encoding: 'utf8' });
        }
        `,
      );

      const issues = findCodePatternIssues(root);
      expect(issues.some((i) => i.kind === 'exec-sync-string')).toBe(true);
    });

    it('does not flag execSync with string literal', () => {
      const root = createProjectRoot();
      projectRoots.push(root);

      writeSourceFile(
        root,
        'packages/demo/src/runner.ts',
        `
        import { execSync } from 'node:child_process';
        function run() {
          return execSync("git status", { encoding: 'utf8' });
        }
        `,
      );

      const issues = findCodePatternIssues(root);
      expect(issues.filter((i) => i.kind === 'exec-sync-string')).toHaveLength(0);
    });

    it('does not flag execFileSync', () => {
      const root = createProjectRoot();
      projectRoots.push(root);

      writeSourceFile(
        root,
        'packages/demo/src/runner.ts',
        `
        import { execFileSync } from 'node:child_process';
        function run(cmd: string) {
          return execFileSync('git', [cmd], { encoding: 'utf8' });
        }
        `,
      );

      const issues = findCodePatternIssues(root);
      expect(issues.filter((i) => i.kind === 'exec-sync-string')).toHaveLength(0);
    });
  });

  describe('TOCTOU stat-then-read', () => {
    it('flags statSync followed by readFileSync on same path', () => {
      const root = createProjectRoot();
      projectRoots.push(root);

      writeSourceFile(
        root,
        'packages/demo/src/loader.ts',
        `
        import { statSync, readFileSync } from 'node:fs';
        function load(path: string) {
          const stat = statSync(path);
          if (stat.isFile()) {
            return readFileSync(path, 'utf8');
          }
        }
        `,
      );

      const issues = findCodePatternIssues(root);
      expect(issues.some((i) => i.kind === 'toctou-stat-read')).toBe(true);
    });

    it('does not flag read without stat', () => {
      const root = createProjectRoot();
      projectRoots.push(root);

      writeSourceFile(
        root,
        'packages/demo/src/loader.ts',
        `
        import { readFileSync } from 'node:fs';
        function load(path: string) {
          return readFileSync(path, 'utf8');
        }
        `,
      );

      const issues = findCodePatternIssues(root);
      expect(issues.filter((i) => i.kind === 'toctou-stat-read')).toHaveLength(0);
    });
  });

  describe('ReDoS regex', () => {
    it('flags nested quantifiers like (a+)+', () => {
      const root = createProjectRoot();
      projectRoots.push(root);

      writeSourceFile(
        root,
        'packages/demo/src/parser.ts',
        `
        const bad = /^(a+)+$/;
        `,
      );

      const issues = findCodePatternIssues(root);
      expect(issues.some((i) => i.kind === 'redos-regex')).toBe(true);
    });

    it('does not flag simple quantified patterns', () => {
      const root = createProjectRoot();
      projectRoots.push(root);

      writeSourceFile(
        root,
        'packages/demo/src/parser.ts',
        `
        const ok = /^[a-z]+$/;
        `,
      );

      const issues = findCodePatternIssues(root);
      expect(issues.filter((i) => i.kind === 'redos-regex')).toHaveLength(0);
    });

    it('flags new RegExp with nested quantifier', () => {
      const root = createProjectRoot();
      projectRoots.push(root);

      writeSourceFile(
        root,
        'packages/demo/src/parser.ts',
        `
        const bad = new RegExp("(\\\\d+)+");
        `,
      );

      const issues = findCodePatternIssues(root);
      expect(issues.some((i) => i.kind === 'redos-regex')).toBe(true);
    });
  });

  it('returns empty array for clean code', () => {
    const root = createProjectRoot();
    projectRoots.push(root);

    writeSourceFile(
      root,
      'packages/demo/src/clean.ts',
      `
      import { execFileSync } from 'node:child_process';
      import { readFileSync } from 'node:fs';

      function clean() {
        const data = readFileSync('/tmp/data.txt', 'utf8');
        const result = execFileSync('git', ['status'], { encoding: 'utf8' });
        const pattern = /^[a-z]+$/;
        return { data, result, pattern };
      }
      `,
    );

    const issues = findCodePatternIssues(root);
    expect(issues).toHaveLength(0);
  });
});
