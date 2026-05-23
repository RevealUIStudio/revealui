import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  barrelReachesNodeBuiltin,
  hasUseClientDirective,
  packageBarrelSource,
  parseSource,
  runtimeModuleRefs,
} from '../client-safety.ts';

/** Convenience: parse + collapse refs to `kind:specifier` tokens. */
function refs(code: string, file = 'sample.tsx'): string[] {
  return runtimeModuleRefs(parseSource(file, code)).map((r) => `${r.kind}:${r.specifier}`);
}

describe('runtimeModuleRefs — value vs type-only imports', () => {
  it('flags a value named import of the security barrel', () => {
    expect(refs("import { isSafeUrl } from '@revealui/security';")).toEqual([
      'import:@revealui/security',
    ]);
  });

  it('ignores a whole-clause `import type` (erased at build)', () => {
    expect(refs("import type { AuditEvent, AuditSystem } from '@revealui/security';")).toEqual([]);
  });

  it('ignores a named import where every binding is `type`-qualified', () => {
    expect(refs("import { type A, type B } from '@revealui/security';")).toEqual([]);
  });

  it('flags a mixed import (one runtime binding alongside type bindings)', () => {
    expect(refs("import { a, type B } from 'x';")).toEqual(['import:x']);
  });

  it('flags default and namespace imports as runtime', () => {
    expect(refs("import Foo from 'x';")).toEqual(['import:x']);
    expect(refs("import * as ns from 'y';")).toEqual(['import:y']);
  });

  it('flags a bare side-effect import', () => {
    expect(refs("import 'side-effect';")).toEqual(['import:side-effect']);
  });

  it('returns nothing for a module with no imports', () => {
    expect(refs('export const x = 1;\nconst y = 2;\n')).toEqual([]);
  });
});

describe('runtimeModuleRefs — re-exports', () => {
  it('flags `export * from` as a runtime re-export', () => {
    expect(refs("export * from '@revealui/security';")).toEqual(['export:@revealui/security']);
  });

  it('flags a value named re-export', () => {
    expect(refs("export { isSafeUrl } from '@revealui/security';")).toEqual([
      'export:@revealui/security',
    ]);
  });

  it('ignores `export type { ... } from`', () => {
    expect(refs("export type { AuditEvent } from '@revealui/security';")).toEqual([]);
  });

  it('ignores a re-export where every binding is `type`-qualified', () => {
    expect(refs("export { type AuditEvent } from '@revealui/security';")).toEqual([]);
  });

  it('does not treat a local `export {}` (no module specifier) as a ref', () => {
    expect(refs('const a = 1;\nexport { a };')).toEqual([]);
  });
});

describe('runtimeModuleRefs — dynamic imports', () => {
  it('flags a dynamic import of a node: builtin', () => {
    expect(refs("const c = await import('node:crypto');")).toEqual(['dynamic:node:crypto']);
  });

  it('flags a dynamic import nested inside a function', () => {
    expect(refs('async function f() { return import("@revealui/security"); }')).toEqual([
      'dynamic:@revealui/security',
    ]);
  });
});

describe('hasUseClientDirective', () => {
  const has = (code: string): boolean => hasUseClientDirective(parseSource('c.tsx', code));

  it('detects a leading double-quoted directive', () => {
    expect(has('"use client";\nimport { x } from "y";')).toBe(true);
  });

  it('detects a leading single-quoted directive', () => {
    expect(has("'use client'\nexport const C = () => null;")).toBe(true);
  });

  it('detects the directive later in the prologue (after other directives)', () => {
    expect(has('"use strict";\n"use client";\n')).toBe(true);
  });

  it('detects the directive after a leading line comment (comments are trivia)', () => {
    expect(has('// banner\n"use client";\n')).toBe(true);
  });

  it('does not treat a string after a real statement as a directive', () => {
    expect(has('import { x } from "y";\n"use client";')).toBe(false);
  });

  it('does not treat an in-function string as a directive', () => {
    expect(has('function f() {\n  "use client";\n}')).toBe(false);
  });

  it('returns false when absent', () => {
    expect(has('export const C = () => null;')).toBe(false);
  });
});

describe('barrelReachesNodeBuiltin (auto-derive within-package walk)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cs-derive-'));
    mkdirSync(join(tmp, 'src'), { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const writeSrc = (rel: string, body: string): void => writeFileSync(join(tmp, 'src', rel), body);
  const reaches = (): boolean => barrelReachesNodeBuiltin(join(tmp, 'src', 'index.ts'), tmp);

  it('true when the barrel statically reaches node: transitively (index -> a -> node:crypto)', () => {
    writeSrc('index.ts', "export { a } from './a.js';");
    writeSrc('a.ts', "import { createHmac } from 'node:crypto';\nexport const a = createHmac;");
    expect(reaches()).toBe(true);
  });

  it('true when the barrel imports a node: builtin directly', () => {
    writeSrc(
      'index.ts',
      "import { resolve4 } from 'node:dns/promises';\nexport const x = resolve4;",
    );
    expect(reaches()).toBe(true);
  });

  it('false for a client-safe barrel (only relative + external imports, no node:)', () => {
    writeSrc('index.ts', "export { a } from './a.js';\nexport { b } from './b.js';");
    writeSrc('a.ts', "import { parse } from 'parse5';\nexport const a = parse;");
    writeSrc('b.ts', 'export const b = 1;');
    expect(reaches()).toBe(false);
  });

  it('false when node: is only behind a dynamic import (code-split, bundle-safe)', () => {
    writeSrc('index.ts', "export { a } from './a.js';");
    writeSrc('a.ts', "export async function a() {\n  return import('node:crypto');\n}");
    expect(reaches()).toBe(false);
  });

  it('does not descend into files outside the package root', () => {
    writeFileSync(join(tmp, 'outside.ts'), "import 'node:crypto';\nexport const o = 1;");
    writeSrc('index.ts', "export { o } from '../outside.js';");
    // pkgDirAbs is tmp/src, so ../outside.ts is outside the package and not followed.
    expect(barrelReachesNodeBuiltin(join(tmp, 'src', 'index.ts'), join(tmp, 'src'))).toBe(false);
  });
});

describe('packageBarrelSource', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cs-barrel-'));
    mkdirSync(join(tmp, 'src'), { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("maps a package's '.' export (dist/index.js) to src/index.ts", () => {
    writeFileSync(
      join(tmp, 'package.json'),
      JSON.stringify({ name: '@revealui/sample', exports: { '.': { import: './dist/index.js' } } }),
    );
    writeFileSync(join(tmp, 'src', 'index.ts'), 'export const x = 1;');
    const got = packageBarrelSource(tmp);
    expect(got?.specifier).toBe('@revealui/sample');
    expect(got?.entryAbs).toBe(join(tmp, 'src', 'index.ts'));
  });

  it('returns null when the package has no "." export', () => {
    writeFileSync(
      join(tmp, 'package.json'),
      JSON.stringify({
        name: '@revealui/sub-only',
        exports: { './server': { import: './dist/server.js' } },
      }),
    );
    expect(packageBarrelSource(tmp)).toBeNull();
  });
});
