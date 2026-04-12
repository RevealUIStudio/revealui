#!/usr/bin/env node

import { createCli } from '../dist/cli.js';

const args = [...process.argv.slice(0, 2), 'create', ...process.argv.slice(2)];

const program = createCli();
await program.parseAsync(args);
