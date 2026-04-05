/**
 * Supported LLM providers across the platform. Single source of truth.
 * Open models only — no proprietary providers (OpenAI, Anthropic, Groq).
 */
export const LLM_PROVIDERS = [
  'ollama',
  'bitnet',
  'huggingface',
  'vultr',
  'inference-snaps',
] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];
