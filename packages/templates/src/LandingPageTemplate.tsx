import { Button, Container, Text } from '@revealui/presentation'
import React from 'react'

export const LandingPageTemplate: React.FC = () => {
	return (
		<Container className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
			<Container as="header" className="container mx-auto px-4 py-8">
				<Container as="nav" className="flex justify-between items-center">
					<Text as="h1" className="text-2xl font-bold text-gray-900">My App</Text>
					<Container className="space-x-4">
						<Text as="a" className="text-gray-600 hover:text-gray-900">Features</Text>
						<Text as="a" className="text-gray-600 hover:text-gray-900">About</Text>
						<Button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
							Get Started
						</Button>
					</Container>
				</Container>
			</Container>

			<Container as="main" className="container mx-auto px-4 py-16">
				<Container className="text-center">
					<Text as="h2" className="text-5xl font-bold text-gray-900 mb-6">
						Welcome to My App
					</Text>
					<Text className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
						Build amazing things without writing code. Our visual builder makes it easy to create beautiful applications.
					</Text>
					<Button className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700">
						Start Building
					</Button>
				</Container>

				<Container as="section" id="features" className="mt-24">
					<Text as="h3" className="text-3xl font-bold text-center text-gray-900 mb-12">Features</Text>
					<Container className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<Container className="text-center p-6 bg-white rounded-lg shadow-lg">
							<Text as="h4" className="text-xl font-semibold mb-4">Easy to Use</Text>
							<Text className="text-gray-600">Drag and drop interface makes building apps simple for everyone.</Text>
						</Container>
						<Container className="text-center p-6 bg-white rounded-lg shadow-lg">
							<Text as="h4" className="text-xl font-semibold mb-4">Fast Deployment</Text>
							<Text className="text-gray-600">Deploy to Vercel with one click and share your app instantly.</Text>
						</Container>
						<Container className="text-center p-6 bg-white rounded-lg shadow-lg">
							<Text as="h4" className="text-xl font-semibold mb-4">Beautiful Design</Text>
							<Text className="text-gray-600">Pre-built components and templates create stunning applications.</Text>
						</Container>
					</Container>
				</Container>
			</Container>
		</Container>
	)
}

