import { z } from 'zod/v4';

/**
 * One entry in a governed run's action log: every tool call and model call
 * the agent performs, in execution order, plus a final entry recording the
 * run's output. This array is the payload the receipt signs — it is the
 * thing a buyer's compliance tooling is actually paying to verify.
 *
 * Shape mirrors `packages/apify-actor-governed-run/src/types.ts`
 * (`ActionLogEntrySchema`) — the fleet's first shipped governed-receipt
 * implementation (GAP-431) — generalized here for use outside the Apify
 * platform. `.strict()` matters: a non-strict schema would silently drop
 * unknown keys during parsing, letting an attacker inject a field into a
 * receipt that the signature never covered.
 */
export const ActionLogEntrySchema = z
  .object({
    index: z.number().int().nonnegative(),
    type: z.enum(['tool_call', 'model_call', 'final_output']),
    timestamp: z.string(),
    detail: z.record(z.string(), z.unknown()),
  })
  .strict();
export type ActionLogEntry = z.infer<typeof ActionLogEntrySchema>;

/**
 * Where this run happened. `null` for every field on a plain local run
 * (`tsx` on a laptop, no hosting platform) — the receipt still verifies
 * (signature integrity holds); it just carries no third-party-attributable
 * run to cross-check against. Fill these in if you deploy the recipe
 * behind a platform that can independently confirm a run identifier
 * (the pattern GAP-431 uses for Apify).
 */
export interface RunContext {
  runnerId: string | null;
  runId: string | null;
}

/**
 * The signed, offline-verifiable receipt returned alongside a run's result.
 *
 * `verifyReceipt` (src/receipts/verify.ts) proves only that these bytes were
 * not altered after signing — it does NOT prove which machine ran the
 * recipe. That is an honest, load-bearing distinction: say it this way in
 * any buyer-facing copy, never "proves the agent ran on our servers."
 */
export const ReceiptSchema = z
  .object({
    actionLog: z.array(ActionLogEntrySchema),
    signature: z.string().min(1),
    publicKey: z.string().min(1),
    algorithm: z.literal('ed25519'),
    timestamp: z.string(),
    runnerId: z.string().nullable(),
    runId: z.string().nullable(),
  })
  .strict();
export type Receipt = z.infer<typeof ReceiptSchema>;
