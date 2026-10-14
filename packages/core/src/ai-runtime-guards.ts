/**
 * Shared AI runtime guards used by admin chat and the API agent stream.
 *
 * REVEALUI_AI_DISABLED is an operator kill switch. It does not change
 * license gates, quotas, or breaker defaults. Only the exact value "true"
 * disables AI. Any other value, including unset, leaves AI available.
 *
 * LLM_CHAT_METER_NAME is the usage_meters.meter_name for one model call.
 * apps/server margin-cost-meters classifies this name as cloud (COGS).
 */

export const AI_DISABLED_ENV = 'REVEALUI_AI_DISABLED';

/** usage_meters.meter_name for an LLM chat call. Classified as cloud cost. */
export const LLM_CHAT_METER_NAME = 'llm.chat';

export function isAiDisabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[AI_DISABLED_ENV] === 'true';
}
