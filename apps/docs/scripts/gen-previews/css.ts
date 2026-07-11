import fs from 'node:fs/promises';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { build } from 'vite';
import { docsRoot, presentationRoot } from './paths.js';

/**
 * Compile the Tailwind v4 CSS covering every class the generated markup uses,
 * plus the canonical --rvui-* tokens. Reuses the docs app's own Tailwind entry
 * (app/index.css: @import "tailwindcss", tokens.css, and the @theme token
 * bridge) so the output matches what the docs/marketing apps ship, and adds no
 * new dependency (@tailwindcss/vite + vite are docs devDeps).
 */
export async function compileCss(
  generatedComponentsDir: string,
  outCssPath: string,
): Promise<void> {
  const tmpDir = path.join(docsRoot, '.gen-preview-css-tmp');
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });

  const entryCss = [
    '@import "../app/index.css";',
    `@source "${presentationRoot}/src";`,
    `@source "${generatedComponentsDir}";`,
    '',
  ].join('\n');
  const entryHtml =
    '<!doctype html><html><head><link rel="stylesheet" href="./entry.css" /></head><body></body></html>';

  await fs.writeFile(path.join(tmpDir, 'entry.css'), entryCss);
  await fs.writeFile(path.join(tmpDir, 'index.html'), entryHtml);

  try {
    await build({
      root: tmpDir,
      logLevel: 'silent',
      plugins: [tailwindcss()],
      build: {
        outDir: path.join(tmpDir, 'dist'),
        emptyOutDir: true,
        cssMinify: false,
        rollupOptions: { input: path.join(tmpDir, 'index.html') },
      },
    });

    const assetsDir = path.join(tmpDir, 'dist', 'assets');
    const files = await fs.readdir(assetsDir);
    const cssFiles = files.filter((f) => f.endsWith('.css')).sort();
    if (cssFiles.length === 0) {
      throw new Error('Tailwind compile produced no CSS asset');
    }
    const parts = await Promise.all(
      cssFiles.map((f) => fs.readFile(path.join(assetsDir, f), 'utf8')),
    );
    await fs.writeFile(outCssPath, `${parts.join('\n').trim()}\n`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
