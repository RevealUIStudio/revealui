/**
 * Supported LLM providers across the platform. Single source of truth.
 * Open models only — no proprietary providers (OpenAI, Anthropic).
 *
 * Two local (no API key required): inference-snaps (Ubuntu, default), ollama.
 * Two cloud (BYOK): groq (LPU silicon), huggingface (model variety).
 */
export const LLM_PROVIDERS = ['groq', 'huggingface', 'inference-snaps', 'ollama'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];
