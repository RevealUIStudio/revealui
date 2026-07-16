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

/** Returns the 409 body when `err` is the resolver's not-configured error, else null. */
export function asLLMNotConfigured(err: unknown): LLMNotConfiguredShape | null {
  if (
    err !== null &&
    typeof err === 'object' &&
    (err as { code?: unknown }).code === 'LLM_NOT_CONFIGURED'
  ) {
    const e = err as { message?: unknown; settingsPath?: unknown };
    return {
      success: false,
      error: typeof e.message === 'string' ? e.message : 'No LLM provider is configured.',
      code: 'LLM_NOT_CONFIGURED',
      settingsPath: typeof e.settingsPath === 'string' ? e.settingsPath : '/settings/api-keys',
    };
  }
  return null;
}
