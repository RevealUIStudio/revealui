export type ComponentType = 'text' | 'button' | 'image' | 'container'

export interface Component {
	id: string
	type: ComponentType
	content?: string
	src?: string
	children?: Component[]
	props?: Record<string, any>
}

export interface BuilderState {
	components: Component[]
	selectedComponent: string | null
	draggedComponent: string | null
}

