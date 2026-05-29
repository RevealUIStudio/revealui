import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDocsServer,
  enumeratePackages,
  getLibraryDoc,
  listLibraries,
  resolveLibrary,
} from '../servers/factories/docs.js';

let root: string;

beforeAll(() => {
  // Build a fake monorepo fixture: two first-party packages (one with a
  // README, one without) plus a third-party package that must be excluded.
  root = mkdtempSync(join(tmpdir(), 'revealui-docs-test-'));
  const pkgs = join(root, 'packages');

  const router = join(pkgs, 'router');
  mkdirSync(router, { recursive: true });
  writeFileSync(
    join(router, 'package.json'),
    JSON.stringify({
      name: '@revealui/router',
      version: '0.3.9',
      description: 'File-based router',
      license: 'MIT',
      homepage: 'https://revealui.com',
      exports: { '.': {}, './server': {} },
    }),
  );
  writeFileSync(join(router, 'README.md'), '# @revealui/router\n\nRouting docs.');

  const core = join(pkgs, 'core');
  mkdirSync(core, { recursive: true });
  writeFileSync(
    join(core, 'package.json'),
    JSON.stringify({
      name: '@revealui/core',
      version: '1.0.0',
      description: 'Core engine',
      license: 'MIT',
    }),
  );

  const vendor = join(pkgs, 'vendor-thing');
  mkdirSync(vendor, { recursive: true });
  writeFileSync(
    join(vendor, 'package.json'),
    JSON.stringify({ name: 'some-vendor-lib', version: '2.0.0' }),
  );
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('enumeratePackages', () => {
  it('includes @revealui/* and excludes third-party', () => {
    const m = enumeratePackages(root);
    expect(m.has('@revealui/router')).toBe(true);
    expect(m.has('@revealui/core')).toBe(true);
    expect([...m.keys()]).not.toContain('some-vendor-lib');
  });

  it('parses exports subpaths, defaulting to "."', () => {
    const m = enumeratePackages(root);
    expect(m.get('@revealui/router')?.exports).toEqual(['.', './server']);
    expect(m.get('@revealui/core')?.exports).toEqual(['.']);
  });

  it('returns an empty map for a root without packages/', () => {
    expect(enumeratePackages(join(root, 'does-not-exist')).size).toBe(0);
  });
});

describe('resolveLibrary', () => {
  it('resolves short id, canonical name, and is case-insensitive', () => {
    const m = enumeratePackages(root);
    expect(resolveLibrary(m, 'router').id).toBe('@revealui/router');
    expect(resolveLibrary(m, '@revealui/router').id).toBe('@revealui/router');
    expect(resolveLibrary(m, 'ROUTER').id).toBe('@revealui/router');
  });

  it('does not resolve a bare third-party name and hints opensrc', () => {
    const m = enumeratePackages(root);
    const r = resolveLibrary(m, 'hono');
    expect(r.resolved).toBe(false);
    expect(r.hint).toContain('opensrc');
  });

  it('flags scoped third-party packages as out of scope', () => {
    const m = enumeratePackages(root);
    expect(resolveLibrary(m, '@hono/node-server').resolved).toBe(false);
  });
});

describe('getLibraryDoc', () => {
  it('returns README + metadata when a README exists', () => {
    const m = enumeratePackages(root);
    const doc = getLibraryDoc(m, 'router');
    expect(doc?.name).toBe('@revealui/router');
    expect(doc?.version).toBe('0.3.9');
    expect(doc?.readme).toContain('Routing docs');
    expect(doc?.exports).toEqual(['.', './server']);
  });

  it('returns null readme when the package has no README', () => {
    const m = enumeratePackages(root);
    const doc = getLibraryDoc(m, 'core');
    expect(doc?.name).toBe('@revealui/core');
    expect(doc?.readme).toBeNull();
  });

  it('returns null for an unknown id', () => {
    const m = enumeratePackages(root);
    expect(getLibraryDoc(m, 'nope')).toBeNull();
  });
});

describe('listLibraries', () => {
  it('lists first-party packages sorted by name', () => {
    const m = enumeratePackages(root);
    expect(listLibraries(m).map((l) => l.name)).toEqual(['@revealui/core', '@revealui/router']);
  });
});

describe('createDocsServer', () => {
  it('constructs a Server instance', () => {
    expect(createDocsServer({ root, serverName: 'revealui-docs-test' })).toBeDefined();
  });
});
