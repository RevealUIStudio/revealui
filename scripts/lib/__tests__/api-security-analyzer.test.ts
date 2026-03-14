import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findApiSecurityIssues } from '../analyzers/api-security-analyzer.js';

function createProjectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'revealui-api-security-'));
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

describe('findApiSecurityIssues', () => {
  it('flags wildcard CORS header mutations', () => {
    const projectRoot = createProjectRoot();
    projectRoots.push(projectRoot);

    writeSourceFile(
      projectRoot,
      'apps/demo/src/route.ts',
      `
      export function handler(response: Response): void {
        response.headers.set('Access-Control-Allow-Origin', '*');
      }
      `,
    );

    const issues = findApiSecurityIssues(projectRoot);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe('cors-wildcard');
  });

  it('flags wildcard origin in cors() config objects', () => {
    const projectRoot = createProjectRoot();
    projectRoots.push(projectRoot);

    writeSourceFile(
      projectRoot,
      'apps/demo/src/api.ts',
      `
      import { cors } from 'hono/cors';

      export const middleware = cors({
        origin: '*',
        credentials: false,
      });
      `,
    );

    const issues = findApiSecurityIssues(projectRoot);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.file).toBe('apps/demo/src/api.ts');
  });

  it('flags wildcard CORSPresets call sites instead of preset definitions', () => {
    const projectRoot = createProjectRoot();
    projectRoots.push(projectRoot);

    writeSourceFile(
      projectRoot,
      'packages/core/src/security/headers.ts',
      `
      export const CORSPresets = {
        permissive: () => ({ origin: '*' }),
        api: () => ({ origin: '*' }),
      };
      `,
    );
    writeSourceFile(
      projectRoot,
      'apps/demo/src/security.ts',
      `
      import { CORSPresets } from '@revealui/core/security';

      export const corsConfig = CORSPresets.api();
      `,
    );

    const issues = findApiSecurityIssues(projectRoot);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.file).toBe('apps/demo/src/security.ts');
  });

  it('ignores wildcard preset definitions when there is no usage site', () => {
    const projectRoot = createProjectRoot();
    projectRoots.push(projectRoot);

    writeSourceFile(
      projectRoot,
      'packages/core/src/security/headers.ts',
      `
      export const CORSPresets = {
        permissive: () => ({ origin: '*' }),
        api: () => ({ origin: '*' }),
      };
      `,
    );

    const issues = findApiSecurityIssues(projectRoot);

    expect(issues).toHaveLength(0);
  });
});
