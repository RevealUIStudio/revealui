import { z } from 'zod/v4';

/**
 * One entry in a governed run's action log. Every model call and every tool
 * call the agent performs becomes exactly one entry, in execution order, plus
 * a final entry recording the run's output. This array is the payload the
 * receipt signs -- it is the thing a customer is paying to have proven.
 */
export const ActionLogEntrySchema = z.object({
  index: z.number().int().nonnegative(),
  type: z.enum(['model_call', 'tool_call', 'final_output']),
  timestamp: z.string(),
  detail: z.record(z.string(), z.unknown()),
});
export type ActionLogEntry = z.infer<typeof ActionLogEntrySchema>;

/** The signed, offline-verifiable receipt returned alongside a run's result. */
export const ReceiptSchema = z.object({
  actionLog: z.array(ActionLogEntrySchema),
  signature: z.string().min(1),
  publicKey: z.string().min(1),
  algorithm: z.literal('ed25519'),
  timestamp: z.string(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

/** Actor input, `run-task` mode: execute an agent task and return a receipt. */
const RunTaskInputSchema = z.object({
  mode: z.literal('run-task').default('run-task'),
  task: z.string().min(1, 'task must not be empty'),
  llmProvider: z.enum(['anthropic', 'openai']),
  llmApiKey: z.string().min(1, 'llmApiKey must not be empty'),
  model: z.string().min(1).optional(),
  toolAllowlist: z.array(z.string()).optional(),
  maxSteps: z.number().int().positive().max(50).optional(),
});
export type RunTaskInput = z.infer<typeof RunTaskInputSchema>;

/** Actor input, `verify-receipt` mode: check a previously issued receipt. */
const VerifyReceiptInputSchema = z.object({
  mode: z.literal('verify-receipt'),
  receipt: z.unknown(),
});
export type VerifyReceiptInput = z.infer<typeof VerifyReceiptInputSchema>;

export const ActorInputSchema = z.discriminatedUnion('mode', [
  RunTaskInputSchema,
  VerifyReceiptInputSchema,
]);
export type ActorInput = z.infer<typeof ActorInputSchema>;

/**
 * Parse and validate raw Apify actor input. Defaults an omitted `mode` to
 * `run-task` before discriminating, since Apify's input schema does not
 * enforce the union -- the actor is the last line of validation for its own
 * contract. Throws a `z.ZodError`-derived message on invalid input; the
 * caller (main.ts) is responsible for surfacing that as a failed run.
 */
export function parseActorInput(raw: unknown): ActorInput {
  const withDefaultMode =
    raw !== null && typeof raw === 'object' && !('mode' in raw)
      ? { ...raw, mode: 'run-task' }
      : raw;
  const result = ActorInputSchema.safeParse(withDefaultMode);
  if (!result.success) {
    throw new Error(`invalid actor input: ${result.error.message}`);
  }
  return result.data;
}
