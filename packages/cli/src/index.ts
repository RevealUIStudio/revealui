#!/usr/bin/env node

/**
 * @revealui/cli - Main orchestrator
 */

import { createCli } from './cli.js';

// If running as main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = createCli();
  cli.parse(process.argv);
}
