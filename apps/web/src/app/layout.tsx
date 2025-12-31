import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
	title: 'RevealUI - Visual Development for Everyone',
	description: 'Build beautiful applications without coding',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en">
			<body className="antialiased">
				{children}
			</body>
		</html>
	)
}