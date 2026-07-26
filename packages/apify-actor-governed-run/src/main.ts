import { LLMClient } from '@revealui/ai';
import { Actor } from 'apify';
import { runGovernedTask } from './agent/run-governed-task.js';
import { selectTools } from './agent/tools.js';
import { CHARGEABLE_EVENTS } from './pricing.config.js';
import { signActionLog } from './receipt/sign.js';
import { verifyReceipt } from './receipt/verify.js';
import { parseActorInput } from './types.js';

await Actor.init();

let failed = false;

try {
  const rawInput = await Actor.getInput();
  const input = parseActorInput(rawInput);

  if (input.mode === 'verify-receipt') {
    await Actor.charge({ eventName: CHARGEABLE_EVENTS.receiptVerification.name });
    const result = verifyReceipt(input.receipt);
    await Actor.pushData(result);
    await Actor.setValue('OUTPUT', result);
  } else {
    const tools = selectTools(input.toolAllowlist);
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

    const receipt = signActionLog(actionLog);
    await Actor.charge({ eventName: CHARGEABLE_EVENTS.runCompleted.name });

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
