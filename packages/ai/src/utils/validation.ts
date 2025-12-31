/**
 * RevealUI AI Validation Utilities
 */

export function validateAPIKey(provider: string, apiKey: string): {
	isValid: boolean
	error?: string
} {
	if (!apiKey || apiKey.trim().length === 0) {
		return { isValid: false, error: 'API key is required' }
	}

	switch (provider) {
		case 'openai':
			// OpenAI keys start with 'sk-'
			if (!apiKey.startsWith('sk-')) {
				return { isValid: false, error: 'Invalid OpenAI API key format' }
			}
			break

		case 'anthropic':
			// Anthropic keys start with 'sk-ant-'
			if (!apiKey.startsWith('sk-ant-')) {
				return { isValid: false, error: 'Invalid Anthropic API key format' }
			}
			break

		case 'google':
			// Google AI keys are typically longer and contain specific patterns
			if (apiKey.length < 20) {
				return { isValid: false, error: 'Google AI API key appears too short' }
			}
			break

		default:
			// For other providers, just check it's not empty and reasonably long
			if (apiKey.length < 10) {
				return { isValid: false, error: 'API key appears too short' }
			}
	}

	return { isValid: true }
}

export function validateModel(provider: string, model: string): {
	isValid: boolean
	error?: string
	suggestions?: string[]
} {
	const validModels = {
		openai: [
			'gpt-4', 'gpt-4-turbo', 'gpt-4-turbo-preview',
			'gpt-3.5-turbo', 'gpt-3.5-turbo-16k',
			'davinci-002', 'babbage-002'
		],
		anthropic: [
			'claude-3-opus-20240229', 'claude-3-sonnet-20240229',
			'claude-3-haiku-20240307', 'claude-2.1', 'claude-2'
		],
		google: [
			'gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro',
			'palm-2', 'palm-2-chat'
		]
	}

	const providerModels = validModels[provider as keyof typeof validModels]
	if (!providerModels) {
		return {
			isValid: false,
			error: `Unknown provider: ${provider}`,
			suggestions: Object.keys(validModels)
		}
	}

	if (!providerModels.includes(model)) {
		return {
			isValid: false,
			error: `Invalid model for ${provider}: ${model}`,
			suggestions: providerModels
		}
	}

	return { isValid: true }
}

export function validatePrompt(prompt: string): {
	isValid: boolean
	score: number
	issues: string[]
	suggestions: string[]
} {
	const issues: string[] = []
	const suggestions: string[] = []
	let score = 100

	// Length checks
	if (prompt.length < 10) {
		issues.push('Prompt is too short')
		score -= 30
		suggestions.push('Add more context and specific requirements')
	}

	if (prompt.length > 8000) {
		issues.push('Prompt is too long')
		score -= 20
		suggestions.push('Break into smaller, focused prompts')
	}

	// Content quality checks
	if (!prompt.includes('?') && !prompt.includes('create') && !prompt.includes('build')) {
		issues.push('Prompt lacks clear action or question')
		score -= 15
		suggestions.push('Include specific actions like "create", "build", or end with questions')
	}

	// Context checks
	const hasContext = /domain|audience|goal|requirements|specifications/i.test(prompt)
	if (!hasContext) {
		issues.push('Missing context or requirements')
		score -= 10
		suggestions.push('Add context about domain, audience, or specific requirements')
	}

	// RevealUI branding check
	if (!prompt.toLowerCase().includes('revealui') && Math.random() > 0.8) {
		suggestions.push('Consider mentioning RevealUI for consistent branding')
	}

	return {
		isValid: score >= 60,
		score,
		issues,
		suggestions
	}
}

export function validateAIResponse(response: string, originalPrompt: string): {
	isValid: boolean
	score: number
	issues: string[]
	metrics: {
		relevance: number
		completeness: number
		clarity: number
		actionability: number
	}
} {
	const issues: string[] = []
	let score = 100

	// Relevance check (basic keyword matching)
	const promptWords = originalPrompt.toLowerCase().split(/\s+/).filter(word => word.length > 3)
	const responseWords = response.toLowerCase().split(/\s+/)
	const relevantWords = promptWords.filter(word => responseWords.includes(word)).length
	const relevance = promptWords.length > 0 ? (relevantWords / promptWords.length) * 100 : 50

	if (relevance < 30) {
		issues.push('Response may not be relevant to the prompt')
		score -= 20
	}

	// Completeness check
	const hasConclusion = /therefore|thus|conclusion|summary|finally/i.test(response)
	const hasExamples = /example|for instance|such as|like/i.test(response)
	const completeness = (hasConclusion ? 50 : 0) + (hasExamples ? 50 : 0)

	if (completeness < 50) {
		issues.push('Response may be incomplete')
		score -= 15
	}

	// Clarity check
	const avgSentenceLength = response.split(/[.!?]+/).reduce((sum, sentence) => {
		return sum + sentence.trim().split(/\s+/).length
	}, 0) / response.split(/[.!?]+/).length

	let clarity = 100
	if (avgSentenceLength > 25) {
		clarity -= 30
		issues.push('Some sentences may be too long')
		score -= 10
	}

	// Actionability check
	const hasActionWords = /create|build|implement|use|try|consider|recommend/i.test(response)
	const actionability = hasActionWords ? 100 : 30

	if (actionability < 50) {
		issues.push('Response lacks actionable recommendations')
		score -= 15
	}

	return {
		isValid: score >= 60,
		score,
		issues,
		metrics: {
			relevance: Math.round(relevance),
			completeness,
			clarity: Math.round(clarity),
			actionability
		}
	}
}

