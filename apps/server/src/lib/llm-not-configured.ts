/**
 * Recognize the resolver's LLMNotConfiguredError across the dynamic-import
 * boundary (GAP-360 §5.2). `@revealui/ai` is lazy-imported at each dispatch
 * site, so `instanceof` is unreliable across module realms; the stable `code`
 * string is the robust discriminator. Maps to HTTP 409 (configuration is the
 * remedy, not payment).
 */

export interface LLMNotConfiguredShape {
  success: false;
  error: string;
  code: 'LLM_NOT_CONFIGURED';
  settingsPath: string;
}

const HOSTED_LLM_CONFIG_CODES = new Set(['LLM_NOT_CONFIGURED', 'HOSTED_ENV_MODEL_KEY_REFUSED']);

/**
 * Returns the 409 body when `err` is a missing account key or a hosted refusal
 * of the deployment env model key. Both are configuration, not a server fault.
 */
export function asLLMNotConfigured(err: unknown): LLMNotConfiguredShape | null {
  if (err === null || typeof err !== 'object') return null;
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string' || !HOSTED_LLM_CONFIG_CODES.has(code)) return null;
  const e = err as { message?: unknown; settingsPath?: unknown };
  return {
    success: false,
    error: typeof e.message === 'string' ? e.message : 'No LLM provider is configured.',
    code: 'LLM_NOT_CONFIGURED',
    settingsPath: typeof e.settingsPath === 'string' ? e.settingsPath : '/settings/api-keys',
  };
}
