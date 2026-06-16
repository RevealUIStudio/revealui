/**
 * CSS ↔ TS parity gate.
 *
 * Asserts that every `--rvui-*` custom property declared in tokens.css is
 * referenced by `tokens` in tokens.ts, and every reference in tokens.ts maps
 * to a declared variable. Drift in either direction fails CI, so the
 * semantic TS API stays physically bound to the CSS canon.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { tokens } from '../tokens.js';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const TOKENS_SRC = join(PKG_ROOT, 'src', 'tokens.css');

/** Walk the tokens object and collect every `--rvui-*` name referenced. */
function collectVarReferences(node: unknown, sink: Set<string>): void {
  if (typeof node === 'string') {
    const prefix = 'var(';
    let cursor = node.indexOf(prefix);
    while (cursor !== -1) {
      const start = cursor + prefix.length;
      const end = node.indexOf(')', start);
      if (end === -1) break;
      const name = node.slice(start, end).trim();
      if (name.startsWith('--rvui-')) sink.add(name);
      cursor = node.indexOf(prefix, end + 1);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectVarReferences(item, sink);
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectVarReferences(value, sink);
  }
}

function collectDeclaredVars(): Set<string> {
  const css = readFileSync(TOKENS_SRC, 'utf8');
  const root = postcss.parse(css);
  const declared = new Set<string>();
  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--rvui-')) declared.add(decl.prop);
  });
  return declared;
}

describe('@revealui/tokens — CSS↔TS parity', () => {
  const declared = collectDeclaredVars();
  const referenced = new Set<string>();
  collectVarReferences(tokens, referenced);

  it('every --rvui-* declared in tokens.css is referenced by tokens.ts', () => {
    const missing = [...declared].filter((name) => !referenced.has(name)).sort();
    expect(missing, `tokens.ts is missing references for: ${missing.join(', ')}`).toEqual([]);
  });

  it('every --rvui-* referenced by tokens.ts is declared in tokens.css', () => {
    const orphans = [...referenced].filter((name) => !declared.has(name)).sort();
    expect(orphans, `tokens.ts references undeclared variables: ${orphans.join(', ')}`).toEqual([]);
  });

  it('declares at least one variable (sanity)', () => {
    expect(declared.size).toBeGreaterThan(0);
    expect(referenced.size).toBeGreaterThan(0);
  });
});
