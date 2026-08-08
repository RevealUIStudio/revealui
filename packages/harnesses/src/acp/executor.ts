/**
 * Prompt execution for the ACP agent plane.
 *
 * Default path: RevealUIAgentAdapter headless-prompt (BYOK / local models).
 * Injected executors are for tests and deterministic CI (no live LLM).
 *
 * I-6: data access goes through the agent adapter / coding tools, never a
 * direct database client from this module.
 */

import { RevealUIAgentAdapter } from '../adapters/revealui-agent-adapter.js';

export interface AcpPromptInput {
  sessionId: string;
  promptText: string;
  cwd: string;
  signal: AbortSignal;
}

export interface AcpPromptResult {
  success: boolean;
  text: string;
}

export type AcpPromptExecutor = (input: AcpPromptInput) => Promise<AcpPromptResult>;

/**
 * Default executor: runs RevealUIAgentAdapter.execute({ type: 'headless-prompt' }).
 * Client-supplied identity is never consulted (I-1).
 */
export function createDefaultAcpPromptExecutor(options?: {
  projectRoot?: string;
  provider?: string;
  model?: string;
}): AcpPromptExecutor {
  return async (input) => {
    if (input.signal.aborted) {
      return { success: false, text: 'cancelled' };
    }
    const adapter = new RevealUIAgentAdapter({
      projectRoot: options?.projectRoot ?? input.cwd,
      provider: options?.provider,
      model: options?.model,
    });
    try {
      const result = await adapter.execute({
        type: 'headless-prompt',
        prompt: input.promptText,
      });
      const message =
        typeof result.message === 'string' && result.message.length > 0
          ? result.message
          : result.success
            ? 'done'
            : 'agent run failed';
      const dataText = result.data !== undefined ? `\n${JSON.stringify(result.data, null, 2)}` : '';
      return {
        success: result.success,
        text: `${message}${dataText}`,
      };
    } finally {
      await adapter.dispose();
    }
  };
}
