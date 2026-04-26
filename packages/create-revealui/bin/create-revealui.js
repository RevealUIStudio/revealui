#!/usr/bin/env node

import { createCli } from '@revealui/cli';

// Inject 'create' subcommand so `npm create revealui my-app` works
// without the user typing `create` explicitly.
const args = [...process.argv.slice(0, 2), 'create', ...process.argv.slice(2)];

const program = createCli();
await program.parseAsync(args);
