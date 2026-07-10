import fs from 'node:fs/promises';
import path from 'node:path';
import { generate } from './generate.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function bundleSize(dir: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await bundleSize(full);
    else total += (await fs.stat(full)).size;
  }
  return total;
}

async function main(): Promise<void> {
  const compileCssStep = !process.argv.includes('--no-css');
  const started = Date.now();
  const result = await generate({ compileCssStep });
  const size = await bundleSize(result.outDir);

  const stubbed = result.components.filter((c) => c.status === 'stub').map((c) => c.name);

  process.stdout.write(
    [
      'design-system previews generated',
      `  out:        ${result.outDir}`,
      `  commit:     ${result.sourceCommit}`,
      `  components: ${result.stats.total} (curated ${result.stats.curated}, default ${result.stats.default}, stub ${result.stats.stub})`,
      `  _preview.css: ${formatBytes(result.cssBytes)}${compileCssStep ? '' : ' (skipped)'}`,
      `  bundle:     ${formatBytes(size)} across ${result.emittedFiles.length + 1} files`,
      stubbed.length ? `  stubbed:    ${stubbed.join(', ')}` : '  stubbed:    none',
      `  took:       ${((Date.now() - started) / 1000).toFixed(1)}s`,
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
