#!/usr/bin/env node
import path from 'node:path';
import { runClaimGates } from './run.js';
import type { ClaimGateResult, ClaimGatesCliOptions, ClaimProfileName } from './types.js';

function parseArgv(argv: readonly string[]): {
  root?: string;
  profile?: ClaimProfileName;
  showFix: boolean;
  warn: boolean;
} {
  let root: string | undefined;
  let profile: ClaimProfileName | undefined;
  let showFix = false;
  let warn = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === '--fix') showFix = true;
    else if (a === '--warn' || a === '--baseline') warn = true;
    else if (a === '--root' && argv[i + 1]) {
      root = argv[++i];
    } else if (a.startsWith('--root=')) {
      root = a.slice('--root='.length);
    } else if (a === '--profile' && argv[i + 1]) {
      profile = argv[++i] as ClaimProfileName;
    } else if (a.startsWith('--profile=')) {
      profile = a.slice('--profile='.length) as ClaimProfileName;
    }
  }
  return { root, profile, showFix, warn };
}

/**
 * CLI entry used by the package bin and the revealui claim-drift wrapper.
 * Does not handle --update-capability-baseline (revealui-local; wrapper only).
 */
export function runClaimGatesCli(options: ClaimGatesCliOptions): ClaimGateResult {
  const argv = options.argv ?? process.argv;
  const parsed = parseArgv(argv);
  // CLI --root wins over options.root so `node dist/cli.js --root <path>` works
  // when the bin entry also defaults root to cwd.
  const root = path.resolve(parsed.root ?? options.root ?? process.cwd());
  const result = runClaimGates({
    root,
    profile: options.profile ?? parsed.profile,
    argv,
    showFix: parsed.showFix,
    warn: parsed.warn || options.warn,
    capability: options.capability,
  });
  if (options.exit !== false) {
    process.exit(result.exitCode);
  }
  return result;
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfJs = path.resolve(import.meta.dirname, 'cli.js');
const selfTs = path.resolve(import.meta.dirname, 'cli.ts');
if (invoked === selfJs || invoked === selfTs) {
  runClaimGatesCli({ root: process.cwd(), argv: process.argv, exit: true });
}
