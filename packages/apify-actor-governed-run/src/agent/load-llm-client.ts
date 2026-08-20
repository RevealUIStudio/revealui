/**
 * Lazily load a BYOK chat client from `@revealui/ai` provider modules.
 *
 * `@revealui/ai` is declared under `optionalDependencies` (package.json)
 * because `verify-receipt` mode never needs it -- only `run-task` mode does.
 *
 * Do not import the package root or `@revealui/ai/llm/client`. Both evaluate
 * SemanticCache → VectorMemoryService → `@revealui/db/client` →
 * `@revealui/config`, which throws REVEALUI_PUBLIC_SERVER_URL in production
 * (Apify Docker sets NODE_ENV=production; Store 0.1.8).
 *
 * Published 0.10.1 exports `./llm/providers/base` with no db/config side
 * effects. Groq, xAI, OpenAI, and Anthropic sit next to that file.
 */
import type { LLMChatOptions, LLMResponse, Message } from '@revealui/ai/llm/providers/base';

export type ByokProvider = 'anthropic' | 'openai' | 'groq' | 'xai';

/** Current Groq-accepted default. Published `@revealui/ai@0.10.1` still
 *  defaults blank Groq to `qwen/qwen3-32b`, which Groq retired. */
export const GROQ_STORE_DEFAULT_MODEL = 'openai/gpt-oss-120b';

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

/**
 * Resolve the model id the Store actor sends to a BYOK provider.
 * Groq blank and retired catalog ids become `openai/gpt-oss-120b` so a
 * blank Model field does not 404 against published `@revealui/ai@0.10.1`.
 */
export function resolveByokModel(
  provider: ByokProvider,
  model: string | undefined,
): string | undefined {
  if (provider !== 'groq') {
    return model;
  }
  const trimmed = model?.trim() ?? '';
  if (trimmed.length === 0 || GROQ_RETIRED_MODELS.has(trimmed)) {
    return GROQ_STORE_DEFAULT_MODEL;
  }
  return trimmed;
}

export interface ByokChatClientConfig {
  provider: ByokProvider;
  apiKey: string;
  model?: string;
}

export interface ByokChatClient {
  chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse>;
}

export type ByokChatClientConstructor = new (config: ByokChatClientConfig) => ByokChatClient;

const PROVIDER_EXPORT = {
  groq: 'GroqProvider',
  xai: 'XaiProvider',
  openai: 'OpenAIProvider',
  anthropic: 'AnthropicProvider',
} as const;

export interface LoadLLMClientDeps {
  resolve: (specifier: string) => string;
  load: (url: string) => Promise<Record<string, unknown>>;
}

function defaultResolve(specifier: string): string {
  return import.meta.resolve(specifier);
}

function defaultLoad(url: string): Promise<Record<string, unknown>> {
  return import(url) as Promise<Record<string, unknown>>;
}

export function providerModuleUrl(provider: ByokProvider, baseHref: string): string {
  return new URL(`./${provider}.js`, baseHref).href;
}

export async function loadLLMClient(
  provider: ByokProvider,
  deps: LoadLLMClientDeps = { resolve: defaultResolve, load: defaultLoad },
): Promise<ByokChatClientConstructor> {
  try {
    const baseHref = deps.resolve('@revealui/ai/llm/providers/base');
    const url = providerModuleUrl(provider, baseHref);
    const mod = await deps.load(url);
    const exportName = PROVIDER_EXPORT[provider];
    const Provider = mod[exportName];
    if (typeof Provider !== 'function') {
      throw new Error(`${url} does not export ${exportName}`);
    }
    const ProviderClass = Provider as new (config: {
      apiKey: string;
      model?: string;
    }) => ByokChatClient;
    return class ByokChatClientAdapter implements ByokChatClient {
      private inner: ByokChatClient;
      constructor(config: ByokChatClientConfig) {
        if (config.provider !== provider) {
          throw new Error(`BYOK client was loaded for ${provider}, received ${config.provider}`);
        }
        this.inner = new ProviderClass({
          apiKey: config.apiKey,
          model: resolveByokModel(provider, config.model),
        });
      }
      chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
        return this.inner.chat(messages, options);
      }
    };
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `run-task mode requires @revealui/ai, which could not be loaded (${cause}). ` +
        '@revealui/ai is an optionalDependency of this package because verify-receipt ' +
        'mode does not need it -- install it to use run-task mode.',
    );
  }
}
