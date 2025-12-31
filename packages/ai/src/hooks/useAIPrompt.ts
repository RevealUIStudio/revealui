/**
 * RevealUI AI Prompt Hook
 * React hook for AI prompt enhancement and management
 */

import { useCallback, useState } from 'react'

import { RevealUIAI } from '../primitives/core.js'
import type { AIConfig } from '../primitives/types.js'

interface PromptTemplate {
	id: string
	name: string
	description: string
	template: string
	variables: string[]
	category: string
}

export function useAIPrompt(config: AIConfig) {
	const ai = new RevealUIAI(config)
	const [prompts, setPrompts] = useState<PromptTemplate[]>([
		{
			id: 'component-generator',
			name: 'Component Generator',
			description: 'Generate React components from descriptions',
			template: 'Create a React component for: {description}\n\nRequirements:\n- Use TypeScript\n- Follow RevealUI design system\n- Include proper accessibility\n- Use Tailwind CSS for styling\n\nComponent: {componentName}',
			variables: ['description', 'componentName'],
			category: 'development'
		},
		{
			id: 'api-designer',
			name: 'API Designer',
			description: 'Design REST API endpoints',
			template: 'Design a REST API for: {feature}\n\nRequirements:\n- RESTful conventions\n- JSON responses\n- Proper HTTP status codes\n- Include authentication if needed\n\nEndpoints:',
			variables: ['feature'],
			category: 'backend'
		},
		{
			id: 'content-writer',
			name: 'Content Writer',
			description: 'Generate marketing content',
			template: 'Write compelling content for: {topic}\n\nTarget audience: {audience}\nTone: {tone}\nGoal: {goal}\n\nContent:',
			variables: ['topic', 'audience', 'tone', 'goal'],
			category: 'marketing'
		}
	])

	const [currentPrompt, setCurrentPrompt] = useState('')
	const [variables, setVariables] = useState<Record<string, string>>({})

	const selectTemplate = useCallback((templateId: string) => {
		const template = prompts.find(p => p.id === templateId)
		if (template) {
			setCurrentPrompt(template.template)
			const initialVars: Record<string, string> = {}
			template.variables.forEach(variable => {
				initialVars[variable] = ''
			})
			setVariables(initialVars)
		}
	}, [prompts])

	const updateVariable = useCallback((variable: string, value: string) => {
		setVariables(prev => ({
			...prev,
			[variable]: value
		}))
	}, [])

	const generatePrompt = useCallback(() => {
		let prompt = currentPrompt
		Object.entries(variables).forEach(([key, value]) => {
			prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value || `[${key}]`)
		})
		return prompt
	}, [currentPrompt, variables])

	const enhancePrompt = useCallback((context?: Record<string, any>) => {
		const basePrompt = generatePrompt()
		return ai.enhancePrompt(basePrompt, context)
	}, [generatePrompt])

	const saveTemplate = useCallback((template: Omit<PromptTemplate, 'id'>) => {
		const newTemplate: PromptTemplate = {
			...template,
			id: Date.now().toString()
		}
		setPrompts(prev => [...prev, newTemplate])
		return newTemplate.id
	}, [])

	const deleteTemplate = useCallback((templateId: string) => {
		setPrompts(prev => prev.filter(p => p.id !== templateId))
	}, [])

	return {
		prompts,
		currentPrompt,
		variables,
		selectTemplate,
		updateVariable,
		generatePrompt,
		enhancePrompt,
		saveTemplate,
		deleteTemplate,
		setCurrentPrompt,
		setVariables
	}
}

