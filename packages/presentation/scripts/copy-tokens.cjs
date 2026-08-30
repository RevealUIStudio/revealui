'use strict';

/**
 * Copy token CSS into dist/ after vite build.
 * Uses fs so the presentation build is not cmd.exe-`cp`/`mkdir -p` (Windows
 * system-tune-snapshot failed: "The syntax of the command is incorrect.").
 */

const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const tokens = join(root, '..', 'tokens');
const dist = join(root, 'dist');
const designContext = join(dist, 'design-context');

mkdirSync(designContext, { recursive: true });
copyFileSync(join(tokens, 'src', 'tokens.css'), join(dist, 'tokens.css'));
copyFileSync(join(tokens, 'src', 'theme.css'), join(dist, 'theme.css'));
copyFileSync(
  join(tokens, 'design-context', 'MANIFEST.sha256'),
  join(designContext, 'MANIFEST.sha256'),
);
copyFileSync(
  join(tokens, 'design-context', 'brand-meta.json'),
  join(designContext, 'brand-meta.json'),
);
copyFileSync(
  join(tokens, 'design-context', 'tokens.css'),
  join(designContext, 'tokens.css'),
);
