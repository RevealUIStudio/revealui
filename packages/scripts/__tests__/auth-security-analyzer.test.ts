import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findAuthSecurityIssues } from '../analyzers/auth-security-analyzer.js';

function createProjectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'revealui-auth-security-'));
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

describe('findAuthSecurityIssues password length', () => {
  it('does not treat a URL password presence check as a length policy', () => {
    const projectRoot = createProjectRoot();
    projectRoots.push(projectRoot);
    writeSourceFile(
      projectRoot,
      'apps/admin/src/policy.ts',
      `
      export function isAllowed(value: string): boolean {
        const url = new URL(value);
        if (url.username.length > 0 || url.password.length > 0) return false;
        return true;
      }
      `,
    );

    const issues = findAuthSecurityIssues(projectRoot).filter(
      (issue) => issue.kind === 'weak-password-requirement',
    );
    expect(issues).toEqual([]);
  });

  it('flags a password minimum below 8 characters', () => {
    const projectRoot = createProjectRoot();
    projectRoots.push(projectRoot);
    writeSourceFile(
      projectRoot,
      'apps/admin/src/password.ts',
      `
      export function accepts(password: string): boolean {
        return password.length > 5;
      }
      `,
    );

    const issues = findAuthSecurityIssues(projectRoot).filter(
      (issue) => issue.kind === 'weak-password-requirement',
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.file).toBe('apps/admin/src/password.ts');
  });

  it('accepts the 8 character floor and an emptiness check on an account password', () => {
    const projectRoot = createProjectRoot();
    projectRoots.push(projectRoot);
    writeSourceFile(
      projectRoot,
      'packages/auth/src/password.ts',
      `
      export function accepts(password: string): boolean {
        if (password.length > 0 && password.length < 8) return false;
        return password.length >= 8;
      }
      `,
    );

    const issues = findAuthSecurityIssues(projectRoot).filter(
      (issue) => issue.kind === 'weak-password-requirement',
    );
    expect(issues).toEqual([]);
  });
});
