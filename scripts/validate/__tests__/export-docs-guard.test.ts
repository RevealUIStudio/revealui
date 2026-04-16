import { describe, expect, it } from 'vitest';
import { extractExports } from '../export-docs-guard.ts';

describe('extractExports', () => {
  it('finds named re-exports', () => {
    const src = `export { Foo, Bar as Baz } from './a';`;
    const names = extractExports(src);
    expect(names.has('Foo')).toBe(true);
    expect(names.has('Baz')).toBe(true);
    expect(names.has('Bar')).toBe(false);
  });

  it('finds export function / class / type / interface / enum', () => {
    const src = `
      export function a() {}
      export class B {}
      export type C = number;
      export interface D {}
      export enum E {}
    `;
    const names = extractExports(src);
    expect([...names].sort()).toEqual(['B', 'C', 'D', 'E', 'a']);
  });

  it('finds multi-declarator export const', () => {
    const src = `export const x = 1, y = 2;`;
    const names = extractExports(src);
    expect(names.has('x')).toBe(true);
    expect(names.has('y')).toBe(true);
  });

  it('ignores star re-exports (intentional — only explicit named removals trip the guard)', () => {
    const src = `export * from './barrel';`;
    const names = extractExports(src);
    expect(names.size).toBe(0);
  });

  it('ignores non-exported declarations', () => {
    const src = `
      function hidden() {}
      const local = 1;
      export const visible = 2;
    `;
    const names = extractExports(src);
    expect(names.has('hidden')).toBe(false);
    expect(names.has('local')).toBe(false);
    expect(names.has('visible')).toBe(true);
  });

  it('detects set difference = removed exports', () => {
    const before = extractExports(`
      export { A, B, C } from './lib';
      export function D() {}
    `);
    const after = extractExports(`
      export { A, C } from './lib';
      export function D() {}
    `);
    const removed = [...before].filter((n) => !after.has(n));
    expect(removed).toEqual(['B']);
  });
});
