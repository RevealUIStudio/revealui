import { useCallback, useState } from 'react'

import type { Component, ComponentType } from './types'

export function useBuilder() {
	const [components, setComponents] = useState<Component[]>([
		{
			id: 'root',
			type: 'container',
			children: []
		}
	])

	const [selectedComponent, setSelectedComponent] = useState<string | null>(null)

	const addComponent = useCallback((type: ComponentType, parentId?: string) => {
		const targetId = parentId || selectedComponent
		const newComponent: Component = {
			id: Math.random().toString(36).substr(2, 9),
			type,
			content: type === 'text' ? 'New text' : type === 'button' ? 'Click me' : undefined,
			children: type === 'container' ? [] : undefined
		}

		setComponents(prev => {
			const updateComponents = (comps: Component[]): Component[] => {
				return comps.map(comp => {
					if (comp.id === targetId && comp.type === 'container') {
						return {
							...comp,
							children: [...(comp.children || []), newComponent]
						}
					}
					if (comp.children) {
						return {
							...comp,
							children: updateComponents(comp.children)
						}
					}
					return comp
				})
			}
			return updateComponents(prev)
		})
	}, [selectedComponent])

	const updateComponent = useCallback((id: string, updates: Partial<Component>) => {
		setComponents(prev => {
			const updateComponents = (comps: Component[]): Component[] => {
				return comps.map(comp => {
					if (comp.id === id) {
						return { ...comp, ...updates }
					}
					if (comp.children) {
						return {
							...comp,
							children: updateComponents(comp.children)
						}
					}
					return comp
				})
			}
			return updateComponents(prev)
		})
	}, [])

	const deleteComponent = useCallback((id: string) => {
		setComponents(prev => {
			const deleteFromComponents = (comps: Component[]): Component[] => {
				return comps
					.filter(comp => comp.id !== id)
					.map(comp => {
						if (comp.children) {
							return {
								...comp,
								children: deleteFromComponents(comp.children)
							}
						}
						return comp
					})
			}
			return deleteFromComponents(prev)
		})

		if (selectedComponent === id) {
			setSelectedComponent(null)
		}
	}, [selectedComponent])

	const generateCode = useCallback(() => {
		// This would generate Next.js code from the components
		// For now, return a placeholder
		return `// Generated Next.js component
export default function GeneratedPage() {
  return (
    <div>
      {/* Generated from ${components.length} components */}
      <h1>Your App</h1>
    </div>
  )
}`
	}, [components])

	return {
		components,
		selectedComponent,
		setSelectedComponent,
		addComponent,
		updateComponent,
		deleteComponent,
		generateCode
	}
}

