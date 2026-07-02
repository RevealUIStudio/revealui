/**
 * Renders the production-runtime path inventory of docs/SECRETS.md as a DERIVED
 * view of SECRET_PATHS (scripts/sync/secret-paths.ts), between the
 * `<!-- BEGIN GENERATED:secret-paths -->` / `<!-- END GENERATED:secret-paths -->`
 * markers. Everything outside the markers (the hand-written prose, the dev/
 * api-keys/credentials/env sections) is left untouched - the workboard-generated
 * -block pattern.
 *
 * Idempotent: re-rendering an already-rendered doc produces no diff.
 * No authored regex: markers are located by line scan (startsWith/indexOf) and
 * the block is spliced with string slicing; the table is built by templating.
 *
 * Usage:
 *   tsx scripts/sync/render-secrets-md.ts           # write docs/SECRETS.md
 *   tsx scripts/sync/render-secrets-md.ts --check    # exit 1 if a re-render would change it
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET_PATHS, type SecretPathDef } from './secret-paths.js';

export const BEGIN_MARKER = '<!-- BEGIN GENERATED:secret-paths -->';
export const END_MARKER = '<!-- END GENERATED:secret-paths -->';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SECRETS_MD_PATH = resolve(HERE, '../../docs/SECRETS.md');

/** The synced prod surface, sorted by path - what the generated block renders. */
export function syncedPathDefs(defs: readonly SecretPathDef[] = SECRET_PATHS): SecretPathDef[] {
  return defs
    .filter((d) => !d.intentionallyUnsynced)
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path));
}

function notesCell(d: SecretPathDef): string {
  const parts: string[] = [];
  if (d.migratingTo !== undefined) {
    parts.push(
      `→ migrating to \`${d.migratingTo}\`${d.migratingSince ? ` (since ${d.migratingSince})` : ''}`,
    );
  }
  if (d.requiredInProdHosted === true) parts.push('required@boot');
  if (d.note !== undefined) parts.push(d.note);
  // Escape pipes so a note never breaks the table (no-regex: split/join).
  return parts.join('; ').split('|').join('\\|');
}

/** Render the inner content of the generated block (between the markers, exclusive). */
export function renderSecretPathsBlock(defs: readonly SecretPathDef[] = SECRET_PATHS): string {
  const rows = syncedPathDefs(defs).map((d) => {
    const consumers = d.consumers.join(', ');
    return `| \`${d.path}\` | ${d.kind} | ${d.sensitive ? 'yes' : 'no'} | ${consumers} | ${notesCell(d)} |`;
  });
  return [
    '',
    '_Machine-generated from [`scripts/sync/secret-paths.ts`](../scripts/sync/secret-paths.ts) by',
    '`scripts/sync/render-secrets-md.ts` - do NOT hand-edit. The lockstep test',
    '(`scripts/sync/__tests__/secret-paths-lockstep.test.ts`) fails CI if this drifts from the',
    'spec, the Vercel/Fly sync manifests, or their sensitivity markers. Change `secret-paths.ts`',
    'and re-run the renderer._',
    '',
    `Production runtime paths synced to Vercel + Fly (${syncedPathDefs(defs).length} paths). \`sensitive\` = the`,
    'value is never UI/API-revealable after write (credentials + private signing keys).',
    '',
    '| Path | Kind | Sensitive | Consumers | Notes |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

/** Replace the content between the markers with `block`. Throws if markers are missing/misordered. */
export function spliceGenerated(current: string, block: string): string {
  const beginIdx = current.indexOf(BEGIN_MARKER);
  const endIdx = current.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(
      `SECRETS.md is missing the generated-block markers (${BEGIN_MARKER} / ${END_MARKER}). ` +
        'Insert them around the production-runtime inventory before rendering.',
    );
  }
  if (endIdx < beginIdx) {
    throw new Error('SECRETS.md generated-block markers are out of order (END before BEGIN).');
  }
  const before = current.slice(0, beginIdx + BEGIN_MARKER.length);
  const after = current.slice(endIdx);
  return `${before}\n${block}\n${after}`;
}

/** Extract the vault paths listed in the generated block - the SAME format the renderer emits. */
export function extractGeneratedPaths(markdown: string): string[] {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    if (line.includes(BEGIN_MARKER)) {
      inBlock = true;
      continue;
    }
    if (line.includes(END_MARKER)) break;
    if (!inBlock) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const firstCell = (trimmed.split('|')[1] ?? '').trim();
    // Data rows carry the path in backticks; the header ('Path') + separator ('---') do not.
    if (firstCell.startsWith('`') && firstCell.endsWith('`') && firstCell.length > 2) {
      out.push(firstCell.slice(1, -1));
    }
  }
  return out;
}

function main(): void {
  const check = process.argv.includes('--check');
  const current = readFileSync(SECRETS_MD_PATH, 'utf8');
  const next = spliceGenerated(current, renderSecretPathsBlock());
  if (check) {
    if (next !== current) {
      process.stderr.write(
        'docs/SECRETS.md is out of sync with secret-paths.ts - run `tsx scripts/sync/render-secrets-md.ts`.\n',
      );
      process.exit(1);
    }
    process.stdout.write('docs/SECRETS.md generated block is in sync.\n');
    return;
  }
  if (next === current) {
    process.stdout.write('docs/SECRETS.md already in sync - no change.\n');
    return;
  }
  writeFileSync(SECRETS_MD_PATH, next);
  process.stdout.write(`Rendered ${syncedPathDefs().length} paths into docs/SECRETS.md.\n`);
}

// Run only when invoked directly (not on import by the test).
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
