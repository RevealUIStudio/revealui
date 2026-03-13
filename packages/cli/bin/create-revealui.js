#!/usr/bin/env node

import { createLegacyCreateCli } from '../dist/cli.js';

const program = createLegacyCreateCli();
await program.parseAsync(process.argv);
