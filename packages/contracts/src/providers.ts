/** Supported LLM providers across the platform. Single source of truth. */
export const LLM_PROVIDERS = [
  'openai',
  'anthropic',
  'groq',
  'ollama',
  'bitnet',
  'huggingface',
  'vultr',
  'inference-snaps',
] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];
