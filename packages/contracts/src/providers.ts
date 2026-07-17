/**
 * Supported LLM providers across the platform. Single source of truth.
 *
 * Two local (no API key required): inference-snaps (Ubuntu, default), ollama.
 * Four cloud (BYOK): groq (LPU silicon), huggingface (model variety),
 * anthropic, openai (frontier providers, added GAP-360 — OpenAI-compatible
 * endpoint configs per the ratified design's provider posture, no proprietary
 * SDKs).
 */
export const LLM_PROVIDERS = [
  'anthropic',
  'openai',
  'groq',
  'huggingface',
  'inference-snaps',
  'ollama',
] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];
