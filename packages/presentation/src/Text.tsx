import React from 'react'

interface TextProps {
	children: React.ReactNode
	className?: string
	as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'a' | 'strong' | 'em' | 'small'
}

export const Text: React.FC<TextProps> = ({
	children,
	className = '',
	as: Component = 'p'
}) => {
	return React.createElement(
		Component,
		{ className },
		children
	)
}