/**
 * Embedding Generation Utilities
 *
 * Functions for generating embeddings using OpenAI API.
 * Supports caching and various embedding models.
 */

import type { Embedding } from "@revealui/contracts/representation";

export interface GenerateEmbeddingOptions {
	model?:
		| "text-embedding-3-small"
		| "text-embedding-3-large"
		| "text-embedding-ada-002";
	cache?: boolean; // Whether to cache embeddings (future feature)
}

/**
 * Generate an embedding for the given text using OpenAI API.
 *
 * @param text - Text to generate embedding for
 * @param options - Options for embedding generation
 * @returns Embedding object with vector and metadata
 *
 * @example
 * ```typescript
 * const embedding = await generateEmbedding('user prefers dark theme')
 * // Returns: { vector: number[], model: 'text-embedding-3-small', dimension: 1536, generatedAt: '...' }
 * ```
 */
export async function generateEmbedding(
	text: string,
	options: GenerateEmbeddingOptions = {},
): Promise<Embedding> {
	const { model = "text-embedding-3-small" } = options;

	if (!process.env.OPENAI_API_KEY) {
		throw new Error("OPENAI_API_KEY environment variable is required");
	}

	if (!text || typeof text !== "string" || text.trim().length === 0) {
		throw new Error("Text must be a non-empty string");
	}

	// Call OpenAI Embeddings API
	const response = await fetch("https://api.openai.com/v1/embeddings", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
		},
		body: JSON.stringify({
			model,
			input: text,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`OpenAI Embeddings API error: ${response.status} - ${errorText}`,
		);
	}

	const data = (await response.json()) as {
		data: Array<{ embedding: number[] }>;
		model: string;
		usage: { prompt_tokens: number; total_tokens: number };
	};

	if (!data.data || !data.data[0] || !data.data[0].embedding) {
		throw new Error("Invalid response from OpenAI Embeddings API");
	}

	const vector = data.data[0].embedding;
	const dimension = vector.length;

	// Map model names to our schema format
	const modelMap: Record<string, string> = {
		"text-embedding-3-small": "openai-text-embedding-3-small",
		"text-embedding-3-large": "openai-text-embedding-3-large",
		"text-embedding-ada-002": "openai-text-embedding-ada-002",
	};

	const embedding: Embedding = {
		vector,
		model: modelMap[model] || model,
		dimension,
		generatedAt: new Date().toISOString(),
	};

	return embedding;
}

/**
 * Generate embeddings for multiple texts in batch.
 *
 * @param texts - Array of texts to generate embeddings for
 * @param options - Options for embedding generation
 * @returns Array of embeddings in the same order as input texts
 */
export async function generateEmbeddings(
	texts: string[],
	options: GenerateEmbeddingOptions = {},
): Promise<Embedding[]> {
	// OpenAI supports batch requests, but for simplicity we'll do them in parallel
	// In production, you might want to batch them into a single API call
	const embeddings = await Promise.all(
		texts.map((text) => generateEmbedding(text, options)),
	);

	return embeddings;
}
