import { describe, expect, it } from 'vitest';
import { hasUseClientDirective, parseSource, runtimeModuleRefs } from '../client-safety.ts';

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
