#!/usr/bin/env node

import { createCli } from '@revealui/cli'

const program = createCli()
await program.parseAsync(process.argv)
