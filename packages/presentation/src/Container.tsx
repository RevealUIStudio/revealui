import React from 'react'

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode
	className?: string
	as?: 'div' | 'section' | 'main' | 'article' | 'header' | 'nav' | 'aside' | 'footer'
}

export const Container: React.FC<ContainerProps> = ({
	children,
	className = '',
	as: Component = 'div',
	...props
}) => {
	return React.createElement(
		Component,
		{ className, ...props },
		children
	)
}
