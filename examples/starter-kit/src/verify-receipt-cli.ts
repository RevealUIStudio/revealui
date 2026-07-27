#!/usr/bin/env tsx
/**
 * Recipe 3 — verify any receipt, fully offline, from the command line.
 *
 * This is the differentiator's other half: your compliance or audit tooling
 * doesn't need this kit, this framework, or a network call to check a
 * receipt — it needs `verifyReceipt` (src/receipts/verify.ts) and a JSON
 * file. This CLI is that check, callable standalone.
 *
 * Run:
 *   pnpm verify-receipt receipt-action.json
 *   pnpm verify-receipt receipt-loop.json
 */
import { readFile } from 'node:fs/promises';
import { verifyReceipt } from './receipts/verify.js';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: pnpm verify-receipt <path-to-receipt.json>');
    process.exitCode = 1;
    return;
  }

  const raw = await readFile(path, 'utf8');
  const receipt: unknown = JSON.parse(raw);
  const result = verifyReceipt(receipt);

  if (result.valid) {
    console.log(`VALID — ${path} verifies offline, no network call made.`);
  } else {
    console.error(`INVALID — ${path}: ${result.reason ?? 'unknown reason'}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
