/**
 * Anthropic Provider
 *
 * Implementation of LLMProvider for Anthropic Claude API
 */

import type {
	Embedding,
	LLMChatOptions,
	LLMChunk,
	LLMEmbedOptions,
	LLMProvider,
	LLMProviderConfig,
	LLMResponse,
	LLMStreamOptions,
	Message,
} from "./base.js";

export interface AnthropicProviderConfig extends LLMProviderConfig {
	apiVersion?: string;
}

export class AnthropicProvider implements LLMProvider {
	private config: AnthropicProviderConfig;
	private baseURL: string;

	constructor(config: AnthropicProviderConfig) {
		this.config = config;
		this.baseURL = config.baseURL || "https://api.anthropic.com/v1";
	}

	async chat(
		messages: Message[],
		options?: LLMChatOptions,
	): Promise<LLMResponse> {
		// Anthropic API format is slightly different
		const systemMessages = messages.filter((m) => m.role === "system");
		const conversationMessages = messages.filter((m) => m.role !== "system");

		const response = await fetch(`${this.baseURL}/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.config.apiKey,
				"anthropic-version": this.config.apiVersion || "2023-06-01",
			},
			body: JSON.stringify({
				model: this.config.model || "claude-3-5-sonnet-20241022",
				system: systemMessages.map((m) => m.content).join("\n"),
				messages: this.formatMessages(conversationMessages),
				temperature: options?.temperature ?? this.config.temperature ?? 0.7,
				max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
				tools: options?.tools,
			}),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: { message: "Unknown error" } }));
			throw new Error(
				`Anthropic API error: ${error.error?.message || response.statusText}`,
			);
		}

		const data = await response.json();

		return {
			content: data.content.find((c: any) => c.type === "text")?.text || "",
			role: "assistant",
			toolCalls: data.content
				.filter((c: any) => c.type === "tool_use")
				.map((tc: any) => ({
					id: tc.id,
					type: "function",
					function: {
						name: tc.name,
						arguments: JSON.stringify(tc.input),
					},
				})),
			finishReason: data.stop_reason,
			usage: data.usage
				? {
						promptTokens: data.usage.input_tokens,
						completionTokens: data.usage.output_tokens,
						totalTokens: data.usage.input_tokens + data.usage.output_tokens,
					}
				: undefined,
		};
	}

	async embed(
		_text: string | string[],
		_options?: LLMEmbedOptions,
	): Promise<Embedding | Embedding[]> {
		// Anthropic doesn't have a separate embeddings API
		// Would need to use a different provider or service
		throw new Error(
			"Anthropic does not support embeddings. Use OpenAI provider for embeddings.",
		);
	}

	async *stream(
		messages: Message[],
		options?: LLMStreamOptions,
	): AsyncIterable<LLMChunk> {
		const systemMessages = messages.filter((m) => m.role === "system");
		const conversationMessages = messages.filter((m) => m.role !== "system");

		const response = await fetch(`${this.baseURL}/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.config.apiKey,
				"anthropic-version": this.config.apiVersion || "2023-06-01",
			},
			body: JSON.stringify({
				model: this.config.model || "claude-3-5-sonnet-20241022",
				system: systemMessages.map((m) => m.content).join("\n"),
				messages: this.formatMessages(conversationMessages),
				temperature: options?.temperature ?? this.config.temperature ?? 0.7,
				max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
				tools: options?.tools,
				stream: true,
			}),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: { message: "Unknown error" } }));
			throw new Error(
				`Anthropic API error: ${error.error?.message || response.statusText}`,
			);
		}

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();

		if (!reader) {
			throw new Error("Response body is not readable");
		}

		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				yield { content: "", done: true };
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (line.startsWith("data: ")) {
					const data = line.slice(6);
					if (data === "[DONE]") {
						yield { content: "", done: true };
						return;
					}

					try {
						const parsed = JSON.parse(data);
						if (
							parsed.type === "content_block_delta" &&
							parsed.delta?.type === "text_delta"
						) {
							yield {
								content: parsed.delta.text || "",
								done: false,
							};
						} else if (parsed.type === "message_stop") {
							yield { content: "", done: true };
							return;
						}
					} catch {
						// Ignore parse errors for incomplete chunks
					}
				}
			}
		}
	}

	private formatMessages(messages: Message[]): any[] {
		return messages
			.map((msg) => {
				if (msg.role === "system") {
					// System messages are handled separately in Anthropic API
					return null;
				}

				const formatted: any = {
					role: msg.role === "assistant" ? "assistant" : "user",
					content: msg.content,
				};

				return formatted;
			})
			.filter(Boolean);
	}
}
