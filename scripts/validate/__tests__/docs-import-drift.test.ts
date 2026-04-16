import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractFences,
  loadExportsFromDts,
  moduleSubpath,
  parseImports,
} from '../docs-import-drift.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('extractFences', () => {
  it('pulls out ts/tsx/typescript fences with line numbers', () => {
    const md = [
      'Some prose',
      '```ts',
      'const a = 1;',
      '```',
      'More prose',
      '```tsx',
      'const b = 2;',
      '```',
      '```bash',
      'ignored',
      '```',
      '```typescript',
      'const c = 3;',
      '```',
    ].join('\n');
    const fences = extractFences(md);
    expect(fences.map((f) => f.code.trim())).toEqual([
      'const a = 1;',
      'const b = 2;',
      'const c = 3;',
    ]);
    expect(fences[0]?.startLine).toBe(3);
  });

  it('accepts trailing metadata on the fence line', () => {
    const md = ['```ts title="example.ts"', 'const x = 1;', '```'].join('\n');
    expect(extractFences(md)).toHaveLength(1);
  });
});

describe('parseImports', () => {
  it('extracts @revealui named imports with correct line offset', () => {
    const code = [
      "import { a } from 'react';",
      "import { hashPassword, verifyPassword } from '@revealui/auth';",
      "import { createLogger } from '@revealui/setup/utils';",
    ].join('\n');
    const refs = parseImports(code, 'fake.md', 10);
    expect(refs).toHaveLength(2);
    expect(refs[0]?.module).toBe('@revealui/auth');
    expect(refs[0]?.names).toEqual(['hashPassword', 'verifyPassword']);
    expect(refs[0]?.line).toBe(11);
    expect(refs[1]?.module).toBe('@revealui/setup/utils');
  });

  it('ignores namespace imports', () => {
    const code = "import * as x from '@revealui/core';";
    expect(parseImports(code, 'fake.md', 0)).toEqual([]);
  });

  it('captures default + named combined imports', () => {
    const code = "import def, { named } from '@revealui/core';";
    const refs = parseImports(code, 'fake.md', 0);
    expect(refs[0]?.hasDefault).toBe(true);
    expect(refs[0]?.names).toEqual(['default', 'named']);
  });
});

describe('moduleSubpath', () => {
  it('splits module specifier into package + subpath', () => {
    expect(moduleSubpath('@revealui/core')).toEqual({ pkg: '@revealui/core', subpath: '.' });
    expect(moduleSubpath('@revealui/core/utils')).toEqual({
      pkg: '@revealui/core',
      subpath: './utils',
    });
    expect(moduleSubpath('@revealui/db/schema/posts')).toEqual({
      pkg: '@revealui/db',
      subpath: './schema/posts',
    });
  });
});

describe('loadExportsFromDts — against real workspace', () => {
  const securityDts = path.join(ROOT, 'packages/security/dist/index.d.ts');

  it('loads a real dist .d.ts and extracts a non-trivial set of exports', () => {
    // Skip if dist hasn't been built (e.g. fresh clone).
    if (!fs.existsSync(securityDts)) return;
    const names = loadExportsFromDts(securityDts);
    expect(names.size).toBeGreaterThan(10);
    // AuditSystem is a stable public export that should persist across refactors.
    expect(names.has('AuditSystem')).toBe(true);
  });
});
