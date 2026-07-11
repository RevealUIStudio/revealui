/**
 * Production font regression gate (GAP-324).
 *
 * docs.revealui.com previously rendered fonts ONLY because it shipped no CSP and
 * linked Inter / Inter Tight / JetBrains Mono from fonts.googleapis.com. GAP-324
 * self-hosts the fonts (@fontsource-variable/*) and adds a CSP whose
 * font-src 'self' data: blocks third-party font hosts. Fontsource registers the
 * "* Variable" family names, so each --font-* stack must lead with those or it
 * resolves to no self-hosted face (the exact bug the marketing site hit first).
 *
 * Asserted here:
 *   (a) index.html references no third-party font host.
 *   (b) app/index.css leads each --font-* stack with a fontsource "* Variable" family.
 *   (c) each declared "* Variable" family is one the installed fontsource package
 *       actually registers, and every package is imported in entry.client.tsx.
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

// Tailwind @theme token → fontsource package + the family it registers via @font-face.
const FONT_MAP = [
  {
    token: '--font-sans',
    fontsourcePackage: '@fontsource-variable/inter',
    variableFamily: '"Inter Variable"',
  },
  {
    token: '--font-display',
    fontsourcePackage: '@fontsource-variable/inter-tight',
    variableFamily: '"Inter Tight Variable"',
  },
  {
    token: '--font-mono',
    fontsourcePackage: '@fontsource-variable/jetbrains-mono',
    variableFamily: '"JetBrains Mono Variable"',
  },
] as const;

describe('docs brand fonts', () => {
  it('index.html references no CSP-blocked third-party font host', () => {
    expect(INDEX_HTML).not.toContain('fonts.googleapis.com');
    expect(INDEX_HTML).not.toContain('fonts.gstatic.com');
  });

  it('app CSS leads each --font-* stack with a self-hosted variable family', () => {
    for (const { token, variableFamily } of FONT_MAP) {
      expect(INDEX_CSS).toContain(`${token}: ${variableFamily}`);
    }
  });

  it('each declared variable family is registered by the installed fontsource package', () => {
    for (const { fontsourcePackage, variableFamily } of FONT_MAP) {
      const packageCss = readFileSync(require.resolve(`${fontsourcePackage}/index.css`), 'utf8');
      // fontsource declares @font-face { font-family: "Inter Variable"; ... }
      // (its own CSS uses single quotes, so compare on the unquoted family name).
      const bareFamily = variableFamily.slice(1, -1);
      expect(packageCss).toContain(bareFamily);
    }
  });

  it('every fontsource package is imported in the client entry', () => {
    for (const { fontsourcePackage } of FONT_MAP) {
      expect(ENTRY_CLIENT).toContain(`import '${fontsourcePackage}'`);
    }
  });
});
