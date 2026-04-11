/**
 * Supported LLM providers across the platform. Single source of truth.
 * Open models only  -  no proprietary providers (OpenAI, Anthropic).
 * All models Apache 2.0 licensed (Gemma 4, Qwen)  -  zero commercial fees.
 */
export const LLM_PROVIDERS = ['ollama', 'huggingface', 'vultr', 'inference-snaps'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];
