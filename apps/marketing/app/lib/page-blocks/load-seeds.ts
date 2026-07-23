/**
 * Collect fleet-marketing page seeds without a hand-maintained array.
 * Each `pages/*.ts` exports a uniquely named `*PageSeed`.
 * Adding a VES page = add `pages/<slug>.ts` only (no seed-array edit, no mono file).
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { FleetMarketingPageSeed } from './shared';

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), 'pages');

function pickSeed(mod: Record<string, unknown>, file: string): FleetMarketingPageSeed {
  for (const [key, value] of Object.entries(mod)) {
    if (key.endsWith('PageSeed') && value && typeof value === 'object') {
      return value as FleetMarketingPageSeed;
    }
  }
  throw new Error(`page-blocks/pages/${file} must export *PageSeed (VES conflict-proof registry)`);
}

export async function loadFleetMarketingPageSeeds(): Promise<readonly FleetMarketingPageSeed[]> {
  const files = readdirSync(pagesDir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort();
  const seeds: FleetMarketingPageSeed[] = [];
  for (const name of files) {
    const href = pathToFileURL(join(pagesDir, name)).href;
    const mod = (await import(href)) as Record<string, unknown>;
    seeds.push(pickSeed(mod, name));
  }
  if (seeds.length === 0) {
    throw new Error('no page seeds found under page-blocks/pages/');
  }
  return [...seeds].sort((a, b) => a.path.localeCompare(b.path));
}
