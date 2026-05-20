import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkFile, findBridgeFiles, run } from '../brand-bridge.ts';

describe('brand-bridge', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-bridge-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function writeFile(relativePath: string, content: string): string {
    const full = path.join(tmp, relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return full;
  }

  describe('checkFile', () => {
    it('returns no violations when --color-primary uses var(--rvui-brand)', () => {
      const filePath = writeFile(
        'apps/admin/src/app/(frontend)/tailwind-theme.css',
        `@theme inline {\n  --color-primary: var(--rvui-brand);\n  --color-ring: var(--rvui-brand);\n}\n`,
      );
      expect(checkFile(filePath)).toHaveLength(0);
    });

    it('returns violation when --color-primary uses hsl(var(--primary))', () => {
      const filePath = writeFile(
        'apps/admin/tailwind-theme.css',
        `@theme inline {\n  --color-primary: hsl(var(--primary));\n  --color-ring: hsl(var(--ring));\n}\n`,
      );
      const violations = checkFile(filePath);
      expect(violations).toHaveLength(2);
      expect(violations[0].property).toBe('--color-primary');
      expect(violations[1].property).toBe('--color-ring');
    });

    it('only flags --color-primary and --color-ring, not other hsl(var()) properties', () => {
      const filePath = writeFile(
        'apps/marketing/app/index.css',
        `@theme inline {\n  --color-primary: var(--rvui-brand);\n  --color-ring: var(--rvui-brand);\n  --color-background: hsl(var(--background));\n}\n`,
      );
      expect(checkFile(filePath)).toHaveLength(0);
    });

    it('ignores --color-primary outside @theme inline blocks', () => {
      const filePath = writeFile(
        'apps/admin/styles.css',
        `:root {\n  --color-primary: hsl(var(--primary));\n}\n`,
      );
      expect(checkFile(filePath)).toHaveLength(0);
    });

    it('detects violation after other properties in @theme inline', () => {
      const filePath = writeFile(
        'apps/admin/tailwind-theme.css',
        `@theme inline {\n  --color-background: var(--rvui-surface-0);\n  --color-primary: hsl(var(--primary));\n  --color-ring: var(--rvui-brand);\n}\n`,
      );
      const violations = checkFile(filePath);
      expect(violations).toHaveLength(1);
      expect(violations[0].property).toBe('--color-primary');
    });

    it('returns no violations for a file with no @theme inline block', () => {
      const filePath = writeFile(
        'apps/docs/app/index.css',
        `@import "tailwindcss";\n\nbody { color: red; }\n`,
      );
      expect(checkFile(filePath)).toHaveLength(0);
    });
  });

  describe('findBridgeFiles', () => {
    it('finds real bridge files in the monorepo', () => {
      const files = findBridgeFiles();
      expect(files.length).toBeGreaterThan(0);
    });

    it('includes the admin tailwind-theme.css', () => {
      const files = findBridgeFiles();
      const hasAdmin = files.some((f) => f.includes('admin') && f.endsWith('tailwind-theme.css'));
      expect(hasAdmin).toBe(true);
    });

    it('includes the marketing index.css', () => {
      const files = findBridgeFiles();
      const hasMarketing = files.some((f) => f.includes('marketing') && f.endsWith('index.css'));
      expect(hasMarketing).toBe(true);
    });
  });

  describe('run (integration)', () => {
    it('exits 0 on the current tree (after cobalt bridge applied)', () => {
      expect(() => run()).not.toThrow();
    });
  });
});
