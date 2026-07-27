#!/usr/bin/env tsx
/**
 * Recipe 1 — a single governed action, signed and verified end to end.
 *
 * The pattern this shows: any sensitive action your agent (or a human
 * clicking a button an agent exposed) takes goes through a `tool_call` that
 * gets logged, then the whole run gets signed into a receipt anyone can
 * verify offline. Governance here doesn't care whether an LLM decided to
 * call the tool — it cares that the action itself is provable after the
 * fact. Swap `issueRefund` below for your own sensitive action (a payout, a
 * permission grant, a data export) and you have the same guarantee.
 *
 * Run:
 *   pnpm recipe:action
 *
 * Output: prints the receipt and writes it to receipt-action.json next to
 * this file's cwd (the kit root).
 */
import { writeFile } from 'node:fs/promises';
import { localRunContext } from '../receipts/run-context.js';
import { signActionLog } from '../receipts/sign.js';
import type { ActionLogEntry } from '../receipts/types.js';
import { verifyReceipt } from '../receipts/verify.js';

interface RefundParams {
  customerId: string;
  amountCents: number;
  reason: string;
}

interface RefundResult {
  success: boolean;
  refundId: string;
}

/** Stand-in for a real sensitive action. Replace with your own tool. */
async function issueRefund(params: RefundParams): Promise<RefundResult> {
  // A real implementation would call your payments provider here. This
  // recipe is about the receipt, not the refund, so it just returns a
  // deterministic fake id.
  return { success: true, refundId: `re_${params.customerId}_${Date.now()}` };
}

async function main(): Promise<void> {
  const params: RefundParams = {
    customerId: 'cus_demo_001',
    amountCents: 4200,
    reason: 'starter-kit recipe demo',
  };

  const actionLog: ActionLogEntry[] = [];

  const callTimestamp = new Date().toISOString();
  const result = await issueRefund(params);
  actionLog.push({
    index: 0,
    type: 'tool_call',
    timestamp: callTimestamp,
    detail: { toolName: 'issue_refund', params, result },
  });
  actionLog.push({
    index: 1,
    type: 'final_output',
    timestamp: new Date().toISOString(),
    detail: { output: `refund ${result.refundId} issued for customer ${params.customerId}` },
  });

  const receipt = signActionLog(actionLog, localRunContext());
  const verified = verifyReceipt(receipt);

  console.log('Governed action complete.');
  console.log(`  tool: issue_refund → ${result.refundId}`);
  console.log(`  receipt signature: ${receipt.signature.slice(0, 40)}…`);
  console.log(`  verifyReceipt(receipt): valid=${verified.valid}`);

  await writeFile('receipt-action.json', `${JSON.stringify(receipt, null, 2)}\n`);
  console.log('  wrote receipt-action.json');

  if (!verified.valid) {
    console.error(`Receipt failed to verify: ${verified.reason ?? 'unknown reason'}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
