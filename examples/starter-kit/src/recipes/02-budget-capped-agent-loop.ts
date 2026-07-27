#!/usr/bin/env tsx
/**
 * Recipe 2 — a multi-step governed agent loop, budget-capped, signed end to
 * end.
 *
 * Mirrors the pattern in `packages/apify-actor-governed-run/src/agent/
 * run-governed-task.ts` (the fleet's first shipped governed-receipt actor,
 * GAP-431) but generalized for use inside your own app: every model call and
 * every tool call becomes one entry in an ordered action log; a chargeAction
 * budget check runs before each billable step; the whole run gets signed
 * into one receipt. `stopReason` is one of 'completed' | 'charge-limit' |
 * 'max-steps' — the same three outcomes the actor uses.
 *
 * Two modes, chosen automatically:
 *   - ANTHROPIC_API_KEY set: makes real Anthropic Messages API calls (plain
 *     fetch, no SDK, no @revealui/ai dependency — this recipe only needs
 *     @revealui/security for the receipt).
 *   - ANTHROPIC_API_KEY unset: runs a scripted, deterministic stand-in
 *     "model" so the recipe is fully runnable offline (no network, no key)
 *     for evaluation and CI. Clearly labeled DEMO_MODE.
 *
 * Run:
 *   pnpm recipe:loop                       # offline demo mode
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm recipe:loop   # real model
 *
 * Output: prints the run and writes receipt-loop.json.
 */
import { writeFile } from 'node:fs/promises';
import { localRunContext } from '../receipts/run-context.js';
import { signActionLog } from '../receipts/sign.js';
import type { ActionLogEntry } from '../receipts/types.js';
import { verifyReceipt } from '../receipts/verify.js';

const MAX_CHARGEABLE_ACTIONS = 5;
const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5';

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const tools: ToolDefinition[] = [
  {
    name: 'check_stock',
    description: 'Look up the current stock level for a SKU.',
    input_schema: {
      type: 'object',
      properties: { sku: { type: 'string' } },
      required: ['sku'],
    },
  },
  {
    name: 'place_reorder',
    description: 'Place a reorder for a SKU at a given quantity.',
    input_schema: {
      type: 'object',
      properties: { sku: { type: 'string' }, quantity: { type: 'number' } },
      required: ['sku', 'quantity'],
    },
  },
];

const STOCK_LEVELS: Record<string, number> = { 'SKU-42': 3 };

function runTool(name: string, input: Record<string, unknown>): unknown {
  if (name === 'check_stock') {
    const sku = String(input['sku']);
    return { sku, quantity: STOCK_LEVELS[sku] ?? 0 };
  }
  if (name === 'place_reorder') {
    return { success: true, sku: input['sku'], quantity: input['quantity'] };
  }
  return { error: `unknown tool: ${name}` };
}

interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
type AnthropicContentBlock = AnthropicToolUseBlock | AnthropicTextBlock;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content:
    | string
    | Array<AnthropicContentBlock | { type: 'tool_result'; tool_use_id: string; content: string }>;
}

async function callAnthropic(messages: AnthropicMessage[]): Promise<{
  content: AnthropicContentBlock[];
  stop_reason: string;
}> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    return callScriptedStandIn(messages);
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, tools, messages }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { content: AnthropicContentBlock[]; stop_reason: string };
  return body;
}

/**
 * A deterministic stand-in for the model, used only when no API key is set.
 * It follows the exact same task the real model would be given: check
 * SKU-42's stock, and if it's below 10, reorder 50 units. This keeps the
 * recipe runnable with zero network access and zero secrets, while still
 * producing a genuine multi-step action log to sign.
 */
function callScriptedStandIn(messages: AnthropicMessage[]): {
  content: AnthropicContentBlock[];
  stop_reason: string;
} {
  const toolResultCount = messages.filter(
    (m) =>
      Array.isArray(m.content) && m.content.some((b) => 'type' in b && b.type === 'tool_result'),
  ).length;

  if (toolResultCount === 0) {
    return {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'call_1', name: 'check_stock', input: { sku: 'SKU-42' } }],
    };
  }
  if (toolResultCount === 1) {
    return {
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'call_2',
          name: 'place_reorder',
          input: { sku: 'SKU-42', quantity: 50 },
        },
      ],
    };
  }
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'Stock for SKU-42 was below threshold; reordered 50 units.' }],
  };
}

async function main(): Promise<void> {
  const demoMode = !process.env['ANTHROPIC_API_KEY'];
  console.log(
    demoMode
      ? 'DEMO_MODE (no ANTHROPIC_API_KEY set) — using a scripted stand-in model, no network calls.'
      : `Live mode — calling ${MODEL}.`,
  );

  const actionLog: ActionLogEntry[] = [];
  let chargeableActions = 0;
  let index = 0;

  function charge(): boolean {
    if (chargeableActions >= MAX_CHARGEABLE_ACTIONS) return false;
    chargeableActions += 1;
    return true;
  }

  const messages: AnthropicMessage[] = [
    {
      role: 'user',
      content:
        "Check the stock level for SKU-42 and, if it's below 10, place a reorder for 50 units.",
    },
  ];

  let stopReason: 'completed' | 'charge-limit' | 'max-steps' = 'max-steps';
  const maxSteps = 6;

  for (let step = 0; step < maxSteps; step++) {
    if (!charge()) {
      stopReason = 'charge-limit';
      break;
    }
    const response = await callAnthropic(messages);
    actionLog.push({
      index: index++,
      type: 'model_call',
      timestamp: new Date().toISOString(),
      detail: { stopReason: response.stop_reason },
    });
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      const finalText = response.content.find((b): b is AnthropicTextBlock => b.type === 'text');
      actionLog.push({
        index: index++,
        type: 'final_output',
        timestamp: new Date().toISOString(),
        detail: { output: finalText?.text ?? '' },
      });
      stopReason = 'completed';
      break;
    }

    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      if (!charge()) {
        stopReason = 'charge-limit';
        break;
      }
      const result = runTool(block.name, block.input);
      actionLog.push({
        index: index++,
        type: 'tool_call',
        timestamp: new Date().toISOString(),
        detail: { toolName: block.name, input: block.input, result },
      });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
    if (stopReason === 'charge-limit') break;
    messages.push({ role: 'user', content: toolResults });
  }

  const receipt = signActionLog(actionLog, localRunContext());
  const verified = verifyReceipt(receipt);

  console.log(`Run complete. stopReason=${stopReason}, actions logged=${actionLog.length}`);
  console.log(`  verifyReceipt(receipt): valid=${verified.valid}`);

  await writeFile('receipt-loop.json', `${JSON.stringify(receipt, null, 2)}\n`);
  console.log('  wrote receipt-loop.json');

  if (!verified.valid) {
    console.error(`Receipt failed to verify: ${verified.reason ?? 'unknown reason'}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
