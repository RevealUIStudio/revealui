#!/usr/bin/env node

import { createLegacyCreateCli } from '@revealui/cli';

const program = createLegacyCreateCli();
await program.parseAsync(process.argv);
