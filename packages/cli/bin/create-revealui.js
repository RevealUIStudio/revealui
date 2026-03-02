#!/usr/bin/env node

import { createCli } from '../dist/cli.js'

const program = createCli()
await program.parseAsync(process.argv)
