/**
 * OpenAI Provider
 *
 * Implementation of LLMProvider for OpenAI API
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

export interface OpenAIProviderConfig extends LLMProviderConfig {
	organization?: string;
}

export class OpenAIProvider implements LLMProvider {
	private config: OpenAIProviderConfig;
	private baseURL: string;

	constructor(config: OpenAIProviderConfig) {
		this.config = config;
		this.baseURL = config.baseURL || "https://api.openai.com/v1";
	}

	async chat(
		messages: Message[],
		options?: LLMChatOptions,
	): Promise<LLMResponse> {
		const response = await fetch(`${this.baseURL}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.config.apiKey}`,
				...(this.config.organization && {
					"OpenAI-Organization": this.config.organization,
				}),
			},
			body: JSON.stringify({
				model: options?.maxTokens
					? undefined
					: this.config.model || "gpt-4o-mini",
				messages: this.formatMessages(messages),
				temperature: options?.temperature ?? this.config.temperature ?? 0.7,
				max_tokens: options?.maxTokens ?? this.config.maxTokens,
				tools: options?.tools,
				tool_choice: options?.toolChoice,
			}),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: { message: "Unknown error" } }));
			throw new Error(
				`OpenAI API error: ${error.error?.message || response.statusText}`,
			);
		}

		const data = await response.json();
		const choice = data.choices[0];

		return {
			content: choice.message.content || "",
			role: "assistant",
			toolCalls: choice.message.tool_calls?.map((tc: any) => ({
				id: tc.id,
				type: "function",
				function: {
					name: tc.function.name,
					arguments: tc.function.arguments,
				},
			})),
			finishReason: choice.finish_reason,
			usage: data.usage
				? {
						promptTokens: data.usage.prompt_tokens,
						completionTokens: data.usage.completion_tokens,
						totalTokens: data.usage.total_tokens,
					}
				: undefined,
		};
	}

	async embed(
		text: string | string[],
		options?: LLMEmbedOptions,
	): Promise<Embedding | Embedding[]> {
		const texts = Array.isArray(text) ? text : [text];
		const model = options?.model || "text-embedding-3-small";

		const response = await fetch(`${this.baseURL}/embeddings`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.config.apiKey}`,
				...(this.config.organization && {
					"OpenAI-Organization": this.config.organization,
				}),
			},
			body: JSON.stringify({
				model,
				input: texts,
			}),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: { message: "Unknown error" } }));
			throw new Error(
				`OpenAI API error: ${error.error?.message || response.statusText}`,
			);
		}

		const data = await response.json();
		const embeddings = data.data.map((item: any) => ({
			vector: item.embedding,
			dimension: item.embedding.length,
			model: item.model || model,
		}));

		return Array.isArray(text) ? embeddings : embeddings[0];
	}

	async *stream(
		messages: Message[],
		options?: LLMStreamOptions,
	): AsyncIterable<LLMChunk> {
		const response = await fetch(`${this.baseURL}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.config.apiKey}`,
				...(this.config.organization && {
					"OpenAI-Organization": this.config.organization,
				}),
			},
			body: JSON.stringify({
				model: this.config.model || "gpt-4o-mini",
				messages: this.formatMessages(messages),
				temperature: options?.temperature ?? this.config.temperature ?? 0.7,
				max_tokens: options?.maxTokens ?? this.config.maxTokens,
				tools: options?.tools,
				stream: true,
			}),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: { message: "Unknown error" } }));
			throw new Error(
				`OpenAI API error: ${error.error?.message || response.statusText}`,
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
						const choice = parsed.choices?.[0];
						if (choice?.delta) {
							yield {
								content: choice.delta.content || "",
								done: false,
								toolCalls: choice.delta.tool_calls?.map((tc: any) => ({
									id: tc.id,
									type: "function",
									function: {
										name: tc.function?.name || "",
										arguments: tc.function?.arguments || "",
									},
								})),
							};
						}
					} catch {
						// Ignore parse errors for incomplete chunks
					}
				}
			}
		}
	}

	private formatMessages(messages: Message[]): any[] {
		return messages.map((msg) => {
			const formatted: any = {
				role: msg.role,
				content: msg.content,
			};

			if (msg.name) {
				formatted.name = msg.name;
			}

			if (msg.toolCalls) {
				formatted.tool_calls = msg.toolCalls.map((tc) => ({
					id: tc.id,
					type: tc.type,
					function: tc.function,
				}));
			}

			if (msg.toolCallId) {
				formatted.tool_call_id = msg.toolCallId;
			}

			return formatted;
		});
	}
}
