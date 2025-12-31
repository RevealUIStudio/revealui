import React from 'react'

interface ImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
	src?: string
	alt?: string
	className?: string
}

export const Image: React.FC<ImageProps> = ({
	src,
	alt = '',
	className = '',
	...props
}) => {
	return (
		<img
			src={src || '/placeholder.jpg'}
			alt={alt}
			className={className}
			{...props}
		/>
	)
}
