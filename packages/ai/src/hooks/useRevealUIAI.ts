/**
 * RevealUI AI Hook
 * React hook for AI interactions
 */

import { useCallback, useRef, useState } from 'react'

import { RevealUIAI } from '../primitives/core.js'
import type { AIConfig, RevealUIAIResponse } from '../primitives/types.js'

export function useRevealUIAI(config: AIConfig) {
	const aiRef = useRef(new RevealUIAI(config))
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const generateText = useCallback(async (
		prompt: string,
		options?: {
			systemPrompt?: string
			temperature?: number
			maxTokens?: number
		}
	): Promise<RevealUIAIResponse> => {
		setIsLoading(true)
		setError(null)

		try {
			const response = await aiRef.current.generateText(prompt, options)
			return response
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error'
			setError(errorMessage)
			return {
				success: false,
				error: errorMessage
			}
		} finally {
			setIsLoading(false)
		}
	}, [])

	const enhancePrompt = useCallback((prompt: string, context?: Record<string, any>) => {
		return aiRef.current.enhancePrompt(prompt, context)
	}, [])

	const validateResponse = useCallback((response: string) => {
		return aiRef.current.validateResponse(response)
	}, [])

	return {
		generateText,
		enhancePrompt,
		validateResponse,
		isLoading,
		error
	}
}

