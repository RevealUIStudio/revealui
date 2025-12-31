/**
 * RevealUI MCP Demo Component
 * Demonstrates integration with Vercel and Stripe MCP servers
 */

'use client'

import { useMCP } from '@revealui/ai'
import { useState } from 'react'

export function MCPDemo() {
	const [vercelProjects, setVercelProjects] = useState<any[]>([])
	const [stripeCustomers, setStripeCustomers] = useState<any[]>([])
	const [deployResult, setDeployResult] = useState<any>(null)
	const [paymentIntent, setPaymentIntent] = useState<any>(null)
	const [loading, setLoading] = useState<string | null>(null)

	const {
		isConnected,
		isConnecting,
		error,
		deployToVercel,
		listVercelProjects,
		createPaymentIntent,
		listStripeCustomers,
		connect
	} = useMCP({
		vercel: {
			accessToken: process.env.NEXT_PUBLIC_VERCEL_ACCESS_TOKEN || '',
			teamId: process.env.NEXT_PUBLIC_VERCEL_TEAM_ID
		},
		stripe: {
			secretKey: process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY || '',
			publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
		}
	})

	const handleConnect = async () => {
		setLoading('Connecting...')
		try {
			await connect()
		} catch (err) {
			console.error('Connection failed:', err)
		} finally {
			setLoading(null)
		}
	}

	const handleListVercelProjects = async () => {
		setLoading('Loading Vercel projects...')
		try {
			const projects = await listVercelProjects()
			setVercelProjects(projects)
		} catch (err) {
			console.error('Failed to list projects:', err)
		} finally {
			setLoading(null)
		}
	}

	const handleDeployToVercel = async () => {
		setLoading('Deploying to Vercel...')
		try {
			const result = await deployToVercel('revealui-demo', './dist')
			setDeployResult(result)
		} catch (err) {
			console.error('Deployment failed:', err)
		} finally {
			setLoading(null)
		}
	}

	const handleCreatePaymentIntent = async () => {
		setLoading('Creating payment intent...')
		try {
			const intent = await createPaymentIntent(1000, 'usd')
			setPaymentIntent(intent)
		} catch (err) {
			console.error('Payment intent creation failed:', err)
		} finally {
			setLoading(null)
		}
	}

	const handleListStripeCustomers = async () => {
		setLoading('Loading Stripe customers...')
		try {
			const customers = await listStripeCustomers()
			setStripeCustomers(customers.data || [])
		} catch (err) {
			console.error('Failed to list customers:', err)
		} finally {
			setLoading(null)
		}
	}

	return (
		<div className="p-6 max-w-4xl mx-auto space-y-6">
			<h1 className="text-3xl font-bold text-gray-900">RevealUI MCP Integration</h1>

			{/* Connection Status */}
			<div className="bg-white rounded-lg shadow p-4">
				<h2 className="text-xl font-semibold mb-4">Connection Status</h2>
				<div className="flex items-center gap-4">
					<div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
					<span className="text-sm">
						{isConnected ? 'Connected to MCP servers' : 'Not connected'}
					</span>
					{isConnecting ? <span className="text-sm text-blue-600">Connecting...</span> : null}
				</div>

				{error ? <div className="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm">
						{error}
					</div> : null}

				{!isConnected && !isConnecting ? <button
						onClick={handleConnect}
						className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
						disabled={isConnecting}
					>
						Connect to MCP
					</button> : null}
			</div>

			{/* Vercel Actions */}
			{isConnected ? <div className="bg-white rounded-lg shadow p-4">
					<h2 className="text-xl font-semibold mb-4">Vercel MCP Actions</h2>
					<div className="space-x-4">
						<button
							onClick={handleListVercelProjects}
							disabled={loading === 'Loading Vercel projects...'}
							className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
						>
							List Projects
						</button>
						<button
							onClick={handleDeployToVercel}
							disabled={loading === 'Deploying to Vercel...'}
							className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
						>
							Deploy Demo
						</button>
					</div>

					{loading ? <p className="mt-2 text-sm text-blue-600">{loading}</p> : null}

					{vercelProjects.length > 0 ? <div className="mt-4">
							<h3 className="font-semibold mb-2">Vercel Projects:</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
								{vercelProjects.map((project: any) => (
									<div key={project.id} className="p-2 bg-gray-50 rounded text-sm">
										{project.name}
									</div>
								))}
							</div>
						</div> : null}

					{deployResult ? <div className="mt-4 p-2 bg-green-50 text-green-700 rounded text-sm">
							<strong>Deployment successful!</strong>
							<pre className="mt-1 text-xs overflow-x-auto">
								{JSON.stringify(deployResult, null, 2)}
							</pre>
						</div> : null}
				</div> : null}

			{/* Stripe Actions */}
			{isConnected ? <div className="bg-white rounded-lg shadow p-4">
					<h2 className="text-xl font-semibold mb-4">Stripe MCP Actions</h2>
					<div className="space-x-4">
						<button
							onClick={handleListStripeCustomers}
							disabled={loading === 'Loading Stripe customers...'}
							className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
						>
							List Customers
						</button>
						<button
							onClick={handleCreatePaymentIntent}
							disabled={loading === 'Creating payment intent...'}
							className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
						>
							Create Payment ($10.00)
						</button>
					</div>

					{stripeCustomers.length > 0 ? <div className="mt-4">
							<h3 className="font-semibold mb-2">Stripe Customers:</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
								{stripeCustomers.slice(0, 5).map((customer: any) => (
									<div key={customer.id} className="p-2 bg-gray-50 rounded text-sm">
										{customer.email || customer.id}
									</div>
								))}
							</div>
						</div> : null}

					{paymentIntent ? <div className="mt-4 p-2 bg-yellow-50 text-yellow-700 rounded text-sm">
							<strong>Payment Intent Created!</strong>
							<pre className="mt-1 text-xs overflow-x-auto">
								{JSON.stringify(paymentIntent, null, 2)}
							</pre>
						</div> : null}
				</div> : null}
		</div>
	)
}
