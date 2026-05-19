import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PKG_ROOT = join(import.meta.dirname, '..');
const SRC_TOKENS = join(PKG_ROOT, 'src', 'tokens.css');
const OUT_DIR = join(PKG_ROOT, 'design-context');
const BANNER =
  'GENERATED from packages/presentation/src/tokens.css — DO NOT EDIT — run pnpm --filter @revealui/presentation gen:design-context';

mkdirSync(OUT_DIR, { recursive: true });

const tokensSrc = readFileSync(SRC_TOKENS, 'utf8');
const metaRaw = readFileSync(join(OUT_DIR, 'brand-meta.json'), 'utf8');
const meta = JSON.parse(metaRaw) as {
  brand: {
    name: string;
    'formal-name': string;
    hue: number;
    'rvui-brand-light': string;
    'rvui-brand-dark': string;
  };
  type: {
    'font-sans': string;
    'font-mono': string;
    'font-display': string;
  };
  voice: { note: string };
};

// MANIFEST.sha256: digest over the SOURCE src/tokens.css bytes (not the copy).
// The copied tokens.css in design-context/ is verbatim with no banner prepended,
// so it is byte-identical to src/tokens.css and both would hash the same. We
// compute over src to make the intent explicit.
const digest = createHash('sha256').update(tokensSrc).digest('hex');

// tokens.css: verbatim copy, no banner inside the file so git diff is clean
// and the manifest digest stays consistent with the source.
writeFileSync(join(OUT_DIR, 'tokens.css'), tokensSrc);

writeFileSync(join(OUT_DIR, 'MANIFEST.sha256'), `${digest}  tokens.css\n`);

writeFileSync(
  join(OUT_DIR, 'brand.md'),
  [
    `<!-- ${BANNER} -->`,
    '',
    `# ${meta.brand.name} — ${meta.brand['formal-name']}`,
    '',
    '## Brand tokens',
    '',
    `| Token | Value |`,
    `| ----- | ----- |`,
    `| \`--rvui-brand\` (light / paper) | \`${meta.brand['rvui-brand-light']}\` |`,
    `| \`--rvui-brand\` (dark / midnight) | \`${meta.brand['rvui-brand-dark']}\` |`,
    `| Hue | \`${meta.brand.hue}\` |`,
    '',
    '## Typography',
    '',
    `| Token | Stack |`,
    `| ----- | ----- |`,
    `| \`--rvui-font-sans\` | \`${meta.type['font-sans']}\` |`,
    `| \`--rvui-font-mono\` | \`${meta.type['font-mono']}\` |`,
    `| \`--rvui-font-display\` | \`${meta.type['font-display']}\` |`,
    '',
    '## Voice',
    '',
    meta.voice.note,
    '',
    '---',
    '',
    `> This file is ${BANNER}.`,
    '> Edit `packages/presentation/src/tokens.css` (canonical) then re-run the generator.',
    '',
  ].join('\n'),
);

// CLAUDE.md is gitignored at the repo root (prevents Claude Code context files from
// being committed). Use README.md — conventional name for a dropped folder, same purpose.
writeFileSync(
  join(OUT_DIR, 'README.md'),
  [
    `<!-- ${BANNER} -->`,
    '',
    '# RevealUI Design Context — Claude Design Pack',
    '',
    'Drop this folder into a Claude Design session.',
    '',
    '`tokens.css` here is a generated mirror of `packages/presentation/src/tokens.css` (canonical).',
    '**Do NOT edit this pack by hand** — edit the source token file and regenerate:',
    '',
    '```bash',
    'pnpm --filter @revealui/presentation gen:design-context',
    '```',
    '',
    '## What is in this pack',
    '',
    '| File | Description |',
    '| ---- | ----------- |',
    '| `tokens.css` | Verbatim copy of the canonical token file |',
    '| `brand-meta.json` | Hand-authored brand canon (name, hue, OKLCH values, type stacks) |',
    '| `brand.md` | Generated brand reference from `brand-meta.json` |',
    '| `MANIFEST.sha256` | SHA-256 of the source `tokens.css` at generation time |',
    '',
    '## Brand',
    '',
    '**Cobalt (Electric Verdigris)**, hue 240.',
    'Light `--rvui-brand`: `oklch(0.36 0.190 240)`.',
    'Dark `--rvui-brand`: `oklch(0.58 0.150 240)` (lifted for WCAG AA).',
    '',
    `> ${BANNER}.`,
    '',
  ].join('\n'),
);
