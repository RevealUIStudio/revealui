/**
 * Provider + model + host pairing for LLM clients.
 *
 * A2A Send Task and /api/agent-stream both construct an LLMClient through
 * resolveLLMClientForRequest. This module is the single place that refuses
 * the production pairing: a Groq catalog id on an OpenAI host
 * (`llama-3.3-70b-versatile` posted to api.openai.com).
 */

import {
  DEFAULT_DAILY_OLLAMA_MODEL,
  DEFAULT_US_ORIGIN_INFERENCE_SNAP,
} from './providers/us-origin-snaps.js';

export type LLMProviderType =
  | 'anthropic'
  | 'openai'
  | 'groq'
  | 'huggingface'
  | 'ollama'
  | 'inference-snaps'
  | 'xai';

/** Groq's recommended replacement for llama-3.3-70b-versatile (retired 2026-08-16). */
export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b';
export const GROQ_DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Groq catalog ids — current and retired — that must never be sent to
 * api.openai.com. Set lookup plus prefix checks; no regex (M2).
 */
const GROQ_CATALOG_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.3-70b-specdec',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-3b-preview',
  'llama-3.2-1b-preview',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'gemma-7b-it',
  'qwen/qwen3-32b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-safeguard-20b',
]);

/** Retired Groq ids that the public API rejects (same error text as OpenAI). */
const GROQ_RETIRED_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.3-70b-specdec',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-3b-preview',
  'llama-3.2-1b-preview',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'gemma-7b-it',
  'qwen/qwen3-32b',
]);

export function isGroqCatalogModel(model: string): boolean {
  if (GROQ_CATALOG_MODELS.has(model)) return true;
  return (
    model.startsWith('llama-3.') ||
    model.startsWith('mixtral-') ||
    model.startsWith('gemma2-') ||
    model.startsWith('openai/gpt-oss') ||
    model.startsWith('qwen/qwen3')
  );
}

/** Default catalog model for a provider. */
export function defaultModelForProvider(provider: LLMProviderType): string | undefined {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-6';
    case 'openai':
      return 'gpt-4o';
    case 'xai':
      return 'grok-4.5';
    case 'groq':
      return GROQ_DEFAULT_MODEL;
    case 'ollama':
      return DEFAULT_DAILY_OLLAMA_MODEL;
    case 'inference-snaps':
      return DEFAULT_US_ORIGIN_INFERENCE_SNAP;
    default:
      return undefined;
  }
}

/** Default OpenAI-compatible base URL for a provider. */
export function defaultBaseURLForProvider(provider: LLMProviderType): string | undefined {
  switch (provider) {
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'xai':
      return 'https://api.x.ai/v1';
    case 'groq':
      return GROQ_DEFAULT_BASE_URL;
    case 'ollama':
      return 'http://localhost:11434/v1';
    case 'inference-snaps':
      return 'http://localhost:9090/v1';
    default:
      return undefined;
  }
}

/** Current Groq-accepted model. Retired catalog ids map to the Groq default. */
export function groqAcceptedModel(requested: string | undefined): string {
  if (requested && isGroqCatalogModel(requested) && !GROQ_RETIRED_MODELS.has(requested)) {
    return requested;
  }
  return GROQ_DEFAULT_MODEL;
}

/**
 * Pick a model that belongs to `provider`. A Groq catalog id is never
 * forwarded to OpenAI (walk residual: `llama-3.3-70b-versatile` on api.openai.com).
 */
export function resolveModelForProvider(
  provider: LLMProviderType,
  requested: string | undefined,
): string | undefined {
  if (provider === 'groq') {
    return groqAcceptedModel(requested);
  }
  if (requested && !isGroqCatalogModel(requested)) {
    return requested;
  }
  return defaultModelForProvider(provider);
}

export interface InferenceRouteInput {
  provider: LLMProviderType;
  model?: string;
  baseURL?: string;
  /** True when a Groq credential is available (saved key or GROQ_API_KEY). */
  groqCredentialAvailable?: boolean;
}

export interface InferenceRoute {
  provider: LLMProviderType;
  model?: string;
  baseURL?: string;
}

const OPENAI_API_HOSTNAME = 'api.openai.com';

/**
 * True only when `url` is a parseable absolute URL whose hostname is exactly
 * api.openai.com. Prefix/substring checks are not used — `api.openai.com.evil.com`
 * must not count as OpenAI (CodeQL js/incomplete-url-substring-sanitization).
 */
function isOpenAiHost(url: string): boolean {
  try {
    return new URL(url).hostname === OPENAI_API_HOSTNAME;
  } catch {
    return false;
  }
}

/**
 * Resolve provider, model, and host together.
 *
 * When the selected model is a Groq catalog id and a Groq credential exists,
 * the request goes to Groq's OpenAI-compatible host with a Groq-accepted
 * model. When the OpenAI client is actually used, a Groq id is replaced
 * with the OpenAI default — never posted to api.openai.com.
 */
export function resolveInferenceRoute(input: InferenceRouteInput): InferenceRoute {
  const groqModel = Boolean(input.model && isGroqCatalogModel(input.model));
  if (groqModel && (input.provider === 'groq' || input.groqCredentialAvailable)) {
    const keepCustomGroqUrl = Boolean(
      input.provider === 'groq' && input.baseURL && !isOpenAiHost(input.baseURL),
    );
    return {
      provider: 'groq',
      model: groqAcceptedModel(input.model),
      baseURL: keepCustomGroqUrl ? input.baseURL : defaultBaseURLForProvider('groq'),
    };
  }

  return {
    provider: input.provider,
    model: resolveModelForProvider(input.provider, input.model),
    baseURL: input.baseURL ?? defaultBaseURLForProvider(input.provider),
  };
}
