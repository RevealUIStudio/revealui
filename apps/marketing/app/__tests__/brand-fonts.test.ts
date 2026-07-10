/**
 * Production font regression gate.
 *
 * Guards the bug chain that shipped the marketing site rendering in
 * system-ui / ui-monospace fallbacks on www.revealui.com (verified live
 * 2026-07-10):
 *
 *   1. index.html linked Inter / Inter Tight / JetBrains Mono from
 *      fonts.googleapis.com, but the production CSP (vercel.json:
 *      font-src 'self' data:) blocks that host, so the stylesheet never
 *      loaded.
 *   2. The app self-hosts the same fonts via @fontsource-variable/*, which
 *      register the "* Variable" family names ("Inter Variable" etc.), yet
 *      the canonical @revealui/tokens stack asks for 'Inter' / 'Inter Tight'
 *      / 'JetBrains Mono', which resolve to no self-hosted face.
 *
 * The fix, asserted here:
 *   (a) index.html references no third-party font host.
 *   (b) app/index.css redeclares the three --rvui-font-* tokens so the
 *       fontsource "* Variable" families lead each stack.
 *   (c) each declared "* Variable" family is one the installed fontsource
 *       package actually registers (so the mapping resolves to a real face),
 *       and every fontsource package is imported in entry.client.tsx.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const APP_DIR = join(import.meta.dirname, '..');

const INDEX_HTML = readFileSync(join(APP_DIR, '..', 'index.html'), 'utf8');
const INDEX_CSS = readFileSync(join(APP_DIR, 'index.css'), 'utf8');
const ENTRY_CLIENT = readFileSync(join(APP_DIR, 'entry.client.tsx'), 'utf8');

// token → fontsource package that supplies its self-hosted face, plus the
// family name that package registers via @font-face.
const FONT_MAP = [
  {
    token: '--rvui-font-sans',
    fontsourcePackage: '@fontsource-variable/inter',
    variableFamily: "'Inter Variable'",
  },
  {
    token: '--rvui-font-display',
    fontsourcePackage: '@fontsource-variable/inter-tight',
    variableFamily: "'Inter Tight Variable'",
  },
  {
    token: '--rvui-font-mono',
    fontsourcePackage: '@fontsource-variable/jetbrains-mono',
    variableFamily: "'JetBrains Mono Variable'",
  },
] as const;

describe('marketing brand fonts', () => {
  it('index.html references no CSP-blocked third-party font host', () => {
    expect(INDEX_HTML).not.toContain('fonts.googleapis.com');
    expect(INDEX_HTML).not.toContain('fonts.gstatic.com');
  });

  it('app CSS redeclares each font token so a self-hosted variable family leads', () => {
    for (const { token, variableFamily } of FONT_MAP) {
      expect(INDEX_CSS).toContain(`${token}: ${variableFamily}`);
    }
  });

  it('each declared variable family is registered by the installed fontsource package', () => {
    for (const { fontsourcePackage, variableFamily } of FONT_MAP) {
      const packageCss = readFileSync(require.resolve(`${fontsourcePackage}/index.css`), 'utf8');
      // fontsource declares @font-face { font-family: 'Inter Variable'; ... }
      expect(packageCss).toContain(`font-family: ${variableFamily}`);
    }
  });

  it('every fontsource package is imported in the client entry', () => {
    for (const { fontsourcePackage } of FONT_MAP) {
      expect(ENTRY_CLIENT).toContain(`import '${fontsourcePackage}'`);
    }
  });
});
