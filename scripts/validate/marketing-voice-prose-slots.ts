// console-allowed
/**
 * Marketing-voice prose-slot freshness gate (source + dist when present).
 *
 * VES session patches on fleet-marketing use block types like `section` /
 * `ctaSection`. The voice engine fail-closes on unmapped types. Source can
 * list those slots while a stale local `packages/contracts/dist` still only
 * has hero/content/cta (dogfood 2026-07-22: 422 unmapped blockType section).
 *
 * - Always validates **source** MARKETING_PROSE_SLOTS keys.
 * - If **dist** exists, validates the same keys on dist (stale dist fails).
 * - If dist is missing and `CI=true`, builds `@revealui/contracts` then checks dist.
 * - If dist is missing offline, source-pass is enough (print rebuild hint).
 *
 * Usage: `pnpm validate:marketing-voice-prose-slots`
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_BLOCKS = path.join(ROOT, 'packages/contracts/dist/marketing-voice/blocks.js');
const SOURCE_BLOCKS = path.join(ROOT, 'packages/contracts/src/marketing-voice/blocks.ts');

/** Must stay in lockstep with packages/contracts/src/marketing-voice/blocks.ts. */
const REQUIRED_SLOTS = [
  'hero',
  'content',
  'cta',
  'section',
  'ctaSection',
  'text',
  'heading',
  'quote',
  'list',
  'divider',
  'spacer',
] as const;

function missingKeys(slots: Record<string, unknown>): string[] {
  return REQUIRED_SLOTS.filter((k) => !(k in slots));
}

async function loadSlots(filePath: string): Promise<Record<string, string[]>> {
  const mod = (await import(pathToFileURL(filePath).href)) as {
    MARKETING_PROSE_SLOTS?: Record<string, string[]>;
  };
  if (!mod.MARKETING_PROSE_SLOTS || typeof mod.MARKETING_PROSE_SLOTS !== 'object') {
    throw new Error(`MARKETING_PROSE_SLOTS not exported from ${path.relative(ROOT, filePath)}`);
  }
  return mod.MARKETING_PROSE_SLOTS;
}

function buildContracts(): void {
  console.log('[marketing-voice-prose-slots] building @revealui/contracts…');
  execFileSync('pnpm', ['--filter', '@revealui/contracts', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

async function main(): Promise<void> {
  const sourceSlots = await loadSlots(SOURCE_BLOCKS);
  const sourceMissing = missingKeys(sourceSlots);
  if (sourceMissing.length > 0) {
    console.error(
      `[marketing-voice-prose-slots] SOURCE missing keys: ${sourceMissing.join(', ')}`,
    );
    process.exit(1);
  }
  console.log('[marketing-voice-prose-slots] source OK');

  let distPath = DIST_BLOCKS;
  if (!existsSync(distPath)) {
    if (process.env.CI === 'true') {
      buildContracts();
    } else {
      console.log(
        '[marketing-voice-prose-slots] dist absent (ok offline) — source passed; ' +
          'run `pnpm --filter @revealui/contracts build` before local API dogfood',
      );
      process.exit(0);
    }
  }

  if (!existsSync(distPath)) {
    console.error(
      `[marketing-voice-prose-slots] still missing ${path.relative(ROOT, DIST_BLOCKS)} after build`,
    );
    process.exit(1);
  }

  // Cache-bust: Node may have cached a prior failed import path.
  distPath = `${DIST_BLOCKS}?t=${Date.now()}`;
  const distSlots = await loadSlots(DIST_BLOCKS);
  const distMissing = missingKeys(distSlots);
  if (distMissing.length > 0) {
    console.error(
      `[marketing-voice-prose-slots] DIST missing keys: ${distMissing.join(', ')}\n` +
        `  Present: ${Object.keys(distSlots).sort().join(', ')}\n` +
        '  Rebuild: pnpm --filter @revealui/contracts build\n' +
        '  (Stale dist → VES voice gate 422: unmapped blockType section)',
    );
    process.exit(1);
  }

  console.log(
    `[marketing-voice-prose-slots] OK — ${REQUIRED_SLOTS.length} required slots in source + dist`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
