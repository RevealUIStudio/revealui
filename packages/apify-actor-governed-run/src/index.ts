/**
 * @revealui/apify-actor-governed-run
 *
 * Not published to npm -- this actor ships to the Apify Store as a Docker
 * image (see Dockerfile + .actor/actor.json). This barrel exists so the
 * receipt verification logic is usable as a plain, standalone import
 * (no Apify SDK, no network, no RevealUI infrastructure) by anything else in
 * the monorepo that wants to check a receipt -- e.g. a future admin tool or
 * CLI -- without depending on the `apify` package.
 */

export { CHARGEABLE_EVENTS, type ChargeableEvent } from './pricing.config.js';
export { signActionLog } from './receipt/sign.js';
export { type ReceiptSignablePayload, receiptSignableBytes } from './receipt/signable.js';
export { type VerifyReceiptResult, verifyReceipt } from './receipt/verify.js';
export {
  type ActionLogEntry,
  ActionLogEntrySchema,
  type ActorInput,
  ActorInputSchema,
  parseActorInput,
  type Receipt,
  ReceiptSchema,
  type RunTaskInput,
  type VerifyReceiptInput,
} from './types.js';
