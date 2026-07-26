import { Actor } from 'apify';
import { loadLLMClient } from './agent/load-llm-client.js';
import { runGovernedTask } from './agent/run-governed-task.js';
import { selectTools } from './agent/tools.js';
import { CHARGEABLE_EVENTS } from './pricing.config.js';
import { signActionLog } from './receipt/sign.js';
import { verifyReceipt } from './receipt/verify.js';
import type { RunContext } from './types.js';
import { parseActorInput } from './types.js';

await Actor.init();

let failed = false;

try {
  const rawInput = await Actor.getInput();
  const input = parseActorInput(rawInput);

  // GAP-431 guardrail-2 blocker 1: bind every receipt to the actual Apify
  // run. `Actor.getEnv()` returns `null` for each field when not running on
  // the platform (e.g. local `pnpm dev`) -- the receipt still signs and
  // verifies, it just carries no platform-attributable run to cross-check.
  const env = Actor.getEnv();
  const runContext: RunContext = {
    actorId: env.actorId,
    actorRunId: env.actorRunId,
    actorBuildId: env.actorBuildId,
  };

  if (input.mode === 'verify-receipt') {
    await Actor.charge({ eventName: CHARGEABLE_EVENTS.receiptVerification.name });
    const result = verifyReceipt(input.receipt);
    await Actor.pushData(result);
    await Actor.setValue('OUTPUT', result);
  } else {
    const tools = selectTools(input.toolAllowlist);
    const LLMClient = await loadLLMClient();
    // Explicit BYOK key from actor input -- never a tenant-stored/DB-resolved
    // key, so constructing this client never touches a database.
    const llmClient = new LLMClient({
      provider: input.llmProvider,
      apiKey: input.llmApiKey,
      model: input.model,
    });

    const { output, actionLog, stopReason } = await runGovernedTask({
      task: input.task,
      tools,
      maxSteps: input.maxSteps,
      chat: (messages, options) => llmClient.chat(messages, options),
      chargeAction: async () => {
        const { eventChargeLimitReached } = await Actor.charge({
          eventName: CHARGEABLE_EVENTS.governedAction.name,
        });
        return !eventChargeLimitReached;
      },
    });

    const receipt = signActionLog(actionLog, runContext);
    await Actor.charge({ eventName: CHARGEABLE_EVENTS.runCompleted.name });

    // Publish the receipt to this run's own platform-controlled dataset/KV
    // store (GAP-431 guardrail-2 blocker 1). A verifier who trusts
    // `receipt.actorRunId` can fetch that run's dataset from the Apify API
    // and confirm the SAME receipt is on record there -- something a
    // standalone forger, who never actually ran on Apify, cannot produce.
    const result = { result: output, stopReason, receipt };
    await Actor.pushData(result);
    await Actor.setValue('OUTPUT', result);
  }
} catch (err) {
  failed = true;
  const message = err instanceof Error ? err.message : String(err);
  await Actor.setValue('OUTPUT', { error: message });
  await Actor.exit(message);
}

if (!failed) {
  await Actor.exit();
} else {
  process.exitCode = 1;
}
