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
          model: config.model,
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
