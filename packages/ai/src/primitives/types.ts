/**
 * RevealUI AI Primitives - Core Types
 * Advanced AI components for building intelligent applications
 */

export interface AIMessage {
	id: string
	role: 'user' | 'assistant' | 'system'
	content: string
	timestamp: Date
	metadata?: Record<string, any>
}

export interface AIConversation {
	id: string
	messages: AIMessage[]
	context?: Record<string, any>
	createdAt: Date
	updatedAt: Date
}

export interface AIProvider {
	name: 'openai' | 'anthropic' | 'google' | 'local'
	apiKey?: string
	baseURL?: string
	models: string[]
}

export interface AIConfig {
	provider: AIProvider
	temperature?: number
	maxTokens?: number
	streaming?: boolean
	systemPrompt?: string
}

export interface AITool {
	name: string
	description: string
	parameters: Record<string, any>
	handler: (args: any) => Promise<any>
}

export interface AIComponent {
	id: string
	type: 'chat' | 'completion' | 'image' | 'audio' | 'video'
	config: AIConfig
	tools?: AITool[]
}

export interface RevealUIAIResponse {
	success: boolean
	data?: any
	error?: string
	usage?: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
	metadata?: Record<string, any>
}

