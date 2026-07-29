#!/usr/bin/env node
// Clean leftover generated markdown under apps/docs/public/ (not docs-pro).
// Used by the legacy copy-docs.sh name and by operators after old materialize builds.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanGeneratedPublicMirror, docsSourceDir } from './docs-publish.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsApp = path.resolve(scriptDir, '..');
const publicDir = path.join(docsApp, 'public');
const docsSource = docsSourceDir(docsApp);

const removed = await cleanGeneratedPublicMirror(publicDir, docsSource);
process.stdout.write(`   Removed ${removed} leftover generated .md file(s).\n`);
