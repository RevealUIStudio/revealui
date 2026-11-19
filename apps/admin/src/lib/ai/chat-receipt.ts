/**
 * Build a llm_call_receipts insert row.
 *
 * The row is a whitelist. Prompt text, response text, and key material are
 * not copied even if a caller attaches them to the input object.
 */

import type { LlmKeySource, NewLlmCallReceipt } from '@revealui/db/schema';

export interface LlmCallReceiptInput {
  id: string;
  userId: string;
  accountId: string | null;
  route: string;
  provider: string;
  model: string;
  keySource: LlmKeySource;
  promptTokens: number;
  completionTokens: number;
  estimatedCostMicros: number;
  createdAt: Date;
}

const RECEIPT_FIELD_NAMES = [
  'id',
  'userId',
  'accountId',
  'route',
  'provider',
  'model',
  'keySource',
  'promptTokens',
  'completionTokens',
  'estimatedCostMicros',
  'createdAt',
] as const;

function nonNegativeInt(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) return 0;
  return value;
}

function bounded(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'unspecified';
  if (trimmed.length <= 200) return trimmed;
  return trimmed.slice(0, 200);
}

export function buildLlmCallReceipt(input: LlmCallReceiptInput): NewLlmCallReceipt {
  const row: NewLlmCallReceipt = {
    id: input.id,
    userId: input.userId,
    accountId: input.accountId,
    route: bounded(input.route),
    provider: bounded(input.provider),
    model: bounded(input.model),
    keySource: input.keySource,
    promptTokens: nonNegativeInt(input.promptTokens),
    completionTokens: nonNegativeInt(input.completionTokens),
    estimatedCostMicros: nonNegativeInt(input.estimatedCostMicros),
    createdAt: input.createdAt,
  };
  const keys = Object.keys(row);
  for (const key of keys) {
    if (!RECEIPT_FIELD_NAMES.includes(key as (typeof RECEIPT_FIELD_NAMES)[number])) {
      throw new Error('llm call receipt included a field outside the whitelist');
    }
  }
  return row;
}
