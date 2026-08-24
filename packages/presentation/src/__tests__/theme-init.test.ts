import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_BOOTSTRAP_SCRIPT,
  THEME_DATA_ATTR,
  THEME_STORAGE_KEY,
  toHtmlSafeJsString,
} from '../theme-init.js';

function runBootstrap(): void {
  // Trusted IIFE authored next to this test; Function avoids a direct eval.
  Function(THEME_BOOTSTRAP_SCRIPT)();
}

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(THEME_DATA_ATTR);
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query !== '(prefers-color-scheme: light)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
  });

  afterEach(() => {
    document.documentElement.removeAttribute(THEME_DATA_ATTR);
    vi.restoreAllMocks();
  });

  it('embeds the same storage key and attribute as useTheme', () => {
    expect(THEME_STORAGE_KEY).toBe('rvui-theme');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_DATA_ATTR);
    expect(THEME_BOOTSTRAP_SCRIPT.startsWith('(function(){')).toBe(true);
  });

  it('escapes HTML metacharacters after JSON.stringify for script-tag embedding', () => {
    expect(toHtmlSafeJsString('rvui-theme')).toBe('"rvui-theme"');
    expect(toHtmlSafeJsString('data-theme')).toBe('"data-theme"');
    expect(toHtmlSafeJsString('</script>')).toBe('"\\u003c/script\\u003e"');
    expect(toHtmlSafeJsString('a&b')).toBe('"a\\u0026b"');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(toHtmlSafeJsString(THEME_STORAGE_KEY));
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(toHtmlSafeJsString(THEME_DATA_ATTR));
  });

  it('applies OS preference when nothing is stored', () => {
    runBootstrap();
    expect(document.documentElement.getAttribute(THEME_DATA_ATTR)).toBe('dark');
  });

  it('honours a stored light preference over a dark OS', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    runBootstrap();
    expect(document.documentElement.getAttribute(THEME_DATA_ATTR)).toBe('light');
  });

  it('honours a stored dark preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    runBootstrap();
    expect(document.documentElement.getAttribute(THEME_DATA_ATTR)).toBe('dark');
  });

  it('treats stored system as OS preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    runBootstrap();
    expect(document.documentElement.getAttribute(THEME_DATA_ATTR)).toBe('dark');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'midnight');
    runBootstrap();
    expect(document.documentElement.getAttribute(THEME_DATA_ATTR)).toBe('dark');
  });

  it('resolves system to light when the OS prefers light', () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query === '(prefers-color-scheme: light)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    runBootstrap();
    expect(document.documentElement.getAttribute(THEME_DATA_ATTR)).toBe('light');
  });

  it('falls back to the OS scheme when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    runBootstrap();
    expect(document.documentElement.getAttribute(THEME_DATA_ATTR)).toBe('dark');
  });

  it('is inlined verbatim on marketing and docs shells', () => {
    const roots = join(__dirname, '../../../../apps');
    for (const rel of ['marketing/index.html', 'docs/index.html']) {
      const html = readFileSync(join(roots, rel), 'utf8');
      expect(html).toContain(THEME_BOOTSTRAP_SCRIPT);
    }
  });

  it('is the payload admin InitTheme injects', () => {
    const src = readFileSync(
      join(__dirname, '../../../../apps/admin/src/lib/providers/Theme/InitTheme/index.tsx'),
      'utf8',
    );
    expect(src).toContain('THEME_BOOTSTRAP_SCRIPT');
  });

  it('is mounted on both admin html shells', () => {
    const roots = join(__dirname, '../../../../apps/admin/src/app');
    for (const rel of ['(frontend)/layout.tsx', '(backend)/layout.tsx']) {
      const src = readFileSync(join(roots, rel), 'utf8');
      expect(src).toContain('InitTheme');
    }
  });
});
