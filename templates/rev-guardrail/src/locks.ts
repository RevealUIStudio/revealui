import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { ENFORCEMENT_VERBS, type GuardrailLocks } from './types.js';

const CashLadderOfferSchema = z
  .object({
    label: z.string().min(1),
    price_usd: z.number().int().positive(),
  })
  .strict();

export const GuardrailLocksSchema = z
  .object({
    version: z.string().min(1),
    note: z.string().min(1),
    lanes: z
      .object({
        one_owner_per_ship: z.boolean(),
        ships: z
          .array(
            z
              .object({
                id: z.string().min(1),
                owner: z.string().min(1),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
    cash_ladder: z
      .object({
        consultation: CashLadderOfferSchema,
        pilot: CashLadderOfferSchema,
        launch: CashLadderOfferSchema,
      })
      .strict(),
    snapshot_before_checkpoint: z.enum(['required', 'optional']),
    overclaim: z
      .object({
        deny_patterns: z.array(z.string()),
        vendor_soc2_allow_patterns: z.array(z.string()),
        empty_deny_list: z.literal('warn'),
      })
      .strict(),
    banned_icp_phrases: z
      .object({
        mode: z.enum(['optional', 'enforced']),
        soft_list: z.array(z.string()),
      })
      .strict(),
    enforcement_verbs: z.array(z.enum(ENFORCEMENT_VERBS)).min(1),
  })
  .strict();

export function parseLocks(input: unknown): GuardrailLocks {
  return GuardrailLocksSchema.parse(input);
}

export function loadLocks(filePath: string): GuardrailLocks {
  const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  return parseLocks(raw);
}

export function emptyDenyListWarning(): string {
  return 'overclaim deny-list is empty: warn, do not silent-pass';
}
