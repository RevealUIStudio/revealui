/**
 * RevealUI AI Streaming Hook
 * React hook for real-time AI text streaming
 */

import { useCallback, useRef, useState } from 'react'

import { RevealUIAI } from '../primitives/core.js'
import type { AIConfig } from '../primitives/types.js'

export function useAIStreaming(config: AIConfig) {
	const aiRef = useRef(new RevealUIAI(config))
	const [isStreaming, setIsStreaming] = useState(false)
	const [streamedText, setStreamedText] = useState('')
	const [error, setError] = useState<string | null>(null)

	const startStreaming = useCallback(async (
		prompt: string,
		options?: {
			systemPrompt?: string
			temperature?: number
			onChunk?: (chunk: string) => void
			onComplete?: (fullText: string) => void
		}
	) => {
		setIsStreaming(true)
		setError(null)
		setStreamedText('')

		try {
			const stream = aiRef.current.streamText(prompt, {
				systemPrompt: options?.systemPrompt,
				temperature: options?.temperature
			})

			let fullText = ''

			for await (const chunk of stream) {
				fullText += chunk
				setStreamedText(fullText)
				options?.onChunk?.(chunk)
			}

			options?.onComplete?.(fullText)
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Streaming error'
			setError(errorMessage)
		} finally {
			setIsStreaming(false)
		}
	}, [])

	const stopStreaming = useCallback(() => {
		setIsStreaming(false)
	}, [])

	const clearStream = useCallback(() => {
		setStreamedText('')
		setError(null)
	}, [])

	return {
		startStreaming,
		stopStreaming,
		clearStream,
		isStreaming,
		streamedText,
		error
	}
}

