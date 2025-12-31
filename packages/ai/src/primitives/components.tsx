/**
 * RevealUI AI Components
 * React components for AI-powered interfaces
 */

import React, { useEffect, useRef, useState } from 'react'

import { RevealUIAI } from './core.js'
import type { AIConfig, AIMessage } from './types.js'

interface AIChatProps {
	config: AIConfig
	placeholder?: string
	className?: string
}

export const AIChat: React.FC<AIChatProps> = ({
	config,
	placeholder = "Ask RevealUI anything...",
	className = ""
}) => {
	const [messages, setMessages] = useState<AIMessage[]>([])
	const [input, setInput] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const ai = new RevealUIAI(config)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	const sendMessage = async () => {
		if (!input.trim() || isLoading) return

		const userMessage: AIMessage = {
			id: Date.now().toString(),
			role: 'user',
			content: input,
			timestamp: new Date()
		}

		setMessages(prev => [...prev, userMessage])
		setInput('')
		setIsLoading(true)

		try {
			const response = await ai.generateText(input)
			const aiMessage: AIMessage = {
				id: (Date.now() + 1).toString(),
				role: 'assistant',
				content: response.success ? response.data.text : `Error: ${response.error}`,
				timestamp: new Date(),
				metadata: response.usage
			}

			setMessages(prev => [...prev, aiMessage])
		} catch (error) {
			const errorMessage: AIMessage = {
				id: (Date.now() + 1).toString(),
				role: 'assistant',
				content: `RevealUI Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				timestamp: new Date()
			}
			setMessages(prev => [...prev, errorMessage])
		} finally {
			setIsLoading(false)
		}
	}

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			sendMessage()
		}
	}

	return (
		<div className={`flex flex-col h-96 bg-white border border-gray-200 rounded-lg ${className}`}>
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.length === 0 ? <div className="text-center text-gray-500 py-8">
						<div className="text-2xl mb-2">🤖</div>
						<p>Welcome to RevealUI AI Assistant</p>
						<p className="text-sm">Ask me anything about building applications!</p>
					</div> : null}
				{messages.map(message => (
					<div
						key={message.id}
						className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
					>
						<div
							className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
								message.role === 'user'
									? 'bg-blue-600 text-white'
									: 'bg-gray-100 text-gray-900'
							}`}
						>
							<p className="text-sm">{message.content}</p>
							{message.metadata ? <p className="text-xs opacity-70 mt-1">
									Tokens: {message.metadata.totalTokens}
								</p> : null}
						</div>
					</div>
				))}
				{isLoading ? <div className="flex justify-start">
						<div className="bg-gray-100 px-4 py-2 rounded-lg">
							<div className="flex space-x-1">
								<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
								<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
								<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
							</div>
						</div>
					</div> : null}
				<div ref={messagesEndRef} />
			</div>

			<div className="border-t border-gray-200 p-4">
				<div className="flex space-x-2">
					<input
						type="text"
						value={input}
						onChange={(e) => { setInput(e.target.value); }}
						onKeyPress={handleKeyPress}
						placeholder={placeholder}
						className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						disabled={isLoading}
					/>
					<button
						onClick={sendMessage}
						disabled={!input.trim() || isLoading}
						className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isLoading ? '...' : 'Send'}
					</button>
				</div>
			</div>
		</div>
	)
}

interface AIPromptEnhancerProps {
	onEnhanced: (enhancedPrompt: string) => void
	className?: string
}

export const AIPromptEnhancer: React.FC<AIPromptEnhancerProps> = ({
	onEnhanced,
	className = ""
}) => {
	const [prompt, setPrompt] = useState('')
	const [domain, setDomain] = useState('')
	const [audience, setAudience] = useState('')
	const [goal, setGoal] = useState('')

	const enhancePrompt = () => {
		if (!prompt.trim()) return

		const ai = new RevealUIAI({
			provider: { name: 'openai', models: ['gpt-4'] }
		})

		const enhanced = ai.enhancePrompt(prompt, {
			domain: domain || undefined,
			audience: audience || undefined,
			goal: goal || undefined
		})

		onEnhanced(enhanced)
	}

	return (
		<div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
			<h3 className="text-lg font-semibold mb-4">RevealUI Prompt Enhancer</h3>

			<div className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Prompt
					</label>
					<textarea
						value={prompt}
						onChange={(e) => { setPrompt(e.target.value); }}
						placeholder="Enter your prompt to enhance..."
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						rows={3}
					/>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Domain
						</label>
						<input
							type="text"
							value={domain}
							onChange={(e) => { setDomain(e.target.value); }}
							placeholder="e.g., healthcare, finance"
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Audience
						</label>
						<input
							type="text"
							value={audience}
							onChange={(e) => { setAudience(e.target.value); }}
							placeholder="e.g., developers, end-users"
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Goal
						</label>
						<input
							type="text"
							value={goal}
							onChange={(e) => { setGoal(e.target.value); }}
							placeholder="e.g., build, explain, optimize"
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>

				<button
					onClick={enhancePrompt}
					disabled={!prompt.trim()}
					className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					🚀 Enhance with RevealUI AI
				</button>
			</div>
		</div>
	)
}

