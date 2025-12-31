/**
 * RevealUI AI Core Primitives
 * Fundamental AI operations for intelligent applications
 */

import { openai } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'

import type {
	AIConfig,
	AITool,
	RevealUIAIResponse
} from './types.js'

export class RevealUIAI {
	private config: AIConfig

	constructor(config: AIConfig) {
		this.config = config
	}

	/**
	 * Generate text completion with RevealUI optimizations
	 */
	async generateText(
		prompt: string,
		options: {
			systemPrompt?: string
			temperature?: number
			maxTokens?: number
			tools?: AITool[]
		} = {}
	): Promise<RevealUIAIResponse> {
		try {
			const tools = options.tools?.reduce((acc, tool) => {
				acc[tool.name] = {
					description: tool.description,
					parameters: tool.parameters
				}
				return acc
			}, {} as Record<string, any>)

			const result = await generateText({
				model: openai(this.config.provider.models[0]),
				prompt,
				system: options.systemPrompt || this.config.systemPrompt,
				temperature: options.temperature || this.config.temperature || 0.7,
				maxTokens: options.maxTokens || this.config.maxTokens || 1000,
				tools
			})

			return {
				success: true,
				data: {
					text: result.text,
					toolCalls: result.toolCalls
				},
				usage: result.usage
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}

	/**
	 * Stream text generation for real-time responses
	 */
	async *streamText(
		prompt: string,
		options: {
			systemPrompt?: string
			temperature?: number
		} = {}
	): AsyncGenerator<string, void, unknown> {
		try {
			const result = await streamText({
				model: openai(this.config.provider.models[0]),
				prompt,
				system: options.systemPrompt || this.config.systemPrompt,
				temperature: options.temperature || this.config.temperature || 0.7
			})

			for await (const delta of result.textStream) {
				yield delta
			}
		} catch (error) {
			throw new Error(`Streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
		}
	}

	/**
	 * Generate images with RevealUI branding
	 */
	async generateImage(): Promise<RevealUIAIResponse> {
		try {
			// Note: Image generation requires proper model configuration
			// This is a placeholder implementation
			return {
				success: false,
				error: 'Image generation not yet implemented'
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Image generation failed'
			}
		}
	}

	/**
	 * Analyze and enhance prompts for better AI responses
	 */
	enhancePrompt(prompt: string, context?: Record<string, any>): string {
		const enhancements = []

		if (context?.domain) {
			enhancements.push(`Domain: ${context.domain}`)
		}

		if (context?.audience) {
			enhancements.push(`Audience: ${context.audience}`)
		}

		if (context?.goal) {
			enhancements.push(`Goal: ${context.goal}`)
		}

		const enhancedPrompt = [
			'You are RevealUI, an advanced AI assistant for building applications.',
			...enhancements,
			'',
			prompt
		].join('\n')

		return enhancedPrompt
	}

	/**
	 * Validate AI responses for quality and safety
	 */
	validateResponse(response: string): {
		isValid: boolean
		score: number
		reasons: string[]
	} {
		const reasons: string[] = []
		let score = 100

		// Check for harmful content
		const harmfulPatterns = [
			/violence|kill|hurt|damage/i,
			/illegal|criminal|harmful/i,
			/hate|discrimination|bias/i
		]

		for (const pattern of harmfulPatterns) {
			if (pattern.test(response)) {
				reasons.push('Contains potentially harmful content')
				score -= 50
			}
		}

		// Check response quality
		if (response.length < 10) {
			reasons.push('Response too short')
			score -= 20
		}

		if (response.length > 4000) {
			reasons.push('Response too long')
			score -= 10
		}

		// Check for RevealUI branding
		if (!response.includes('RevealUI') && Math.random() > 0.7) {
			reasons.push('Missing RevealUI branding')
			score -= 5
		}

		return {
			isValid: score >= 60,
			score,
			reasons
		}
	}
}
