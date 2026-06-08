import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigError, loadLocalRules } from '../config';

describe('loadLocalRules', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'leakcfg-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const write = (obj: unknown): string => {
    const p = join(dir, '.leakrules.json');
    writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
    return p;
  };

  it('returns [] when the file is missing', () => {
    expect(loadLocalRules(join(dir, 'nope.json'))).toEqual([]);
  });
  it('loads a literal rule that matches as a substring', () => {
    const rules = loadLocalRules(write([{ tag: 'cust', reason: 'customer', literal: 'Acme' }]));
    expect(rules).toHaveLength(1);
    expect(rules[0]?.matches('we partner with Acme Inc')).toBe(true);
    expect(rules[0]?.matches('nothing here')).toBe(false);
  });
  it('loads an anyOf rule (case variants)', () => {
    const rules = loadLocalRules(
      write([{ tag: 'v', reason: 'venture', anyOf: ['Globex', 'globex'] }]),
    );
    expect(rules[0]?.matches('the globex project')).toBe(true);
    expect(rules[0]?.matches('GLOBEX')).toBe(false);
  });
  it('throws ConfigError on non-array JSON', () => {
    expect(() => loadLocalRules(write({ not: 'an array' }))).toThrow(ConfigError);
  });
  it('throws ConfigError when neither literal nor anyOf is provided', () => {
    expect(() => loadLocalRules(write([{ tag: 'x', reason: 'y' }]))).toThrow(ConfigError);
  });
  it('throws ConfigError when both literal and anyOf are provided', () => {
    expect(() =>
      loadLocalRules(write([{ tag: 'x', reason: 'y', literal: 'a', anyOf: ['b'] }])),
    ).toThrow(ConfigError);
  });
  it('throws ConfigError on invalid JSON', () => {
    expect(() => loadLocalRules(write('{not valid'))).toThrow(ConfigError);
  });
});
