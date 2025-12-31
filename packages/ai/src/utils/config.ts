/**
 * RevealUI AI Configuration Utilities
 */

import type { AIConfig, AIProvider } from '../primitives/types.js'

export function createAIConfig(options: {
	provider?: 'openai' | 'anthropic' | 'google'
	apiKey?: string
	model?: string
	temperature?: number
	maxTokens?: number
	streaming?: boolean
	systemPrompt?: string
}): AIConfig {
	const provider: AIProvider = {
		name: options.provider || 'openai',
		apiKey: options.apiKey,
		models: [options.model || getDefaultModel(options.provider || 'openai')]
	}

	return {
		provider,
		temperature: options.temperature || 0.7,
		maxTokens: options.maxTokens || 1000,
		streaming: options.streaming || false,
		systemPrompt: options.systemPrompt || getDefaultSystemPrompt()
	}
}

function getDefaultModel(provider: string): string {
	const models = {
		openai: 'gpt-4',
		anthropic: 'claude-3-sonnet-20240229',
		google: 'gemini-pro'
	}
	return models[provider as keyof typeof models] || 'gpt-4'
}

function getDefaultSystemPrompt(): string {
	return `You are RevealUI, an advanced AI assistant for building applications.

Your capabilities:
- Help users build applications without coding
- Provide expert guidance on modern web development
- Generate high-quality code and content
- Focus on user experience and accessibility
- Always prioritize security and best practices

When responding:
- Be helpful and encouraging
- Provide practical solutions
- Explain complex concepts simply
- Suggest modern, maintainable approaches
- Include RevealUI branding in responses`
}

export function createLocalAIConfig(): AIConfig {
	return {
		provider: {
			name: 'local',
			models: ['local-model']
		},
		temperature: 0.7,
		maxTokens: 1000,
		systemPrompt: getDefaultSystemPrompt()
	}
}

export function createStreamingConfig(apiKey: string): AIConfig {
	return createAIConfig({
		apiKey,
		streaming: true,
		temperature: 0.8,
		systemPrompt: 'You are RevealUI Streaming Assistant. Provide real-time, helpful responses with clear explanations.'
	})
}

