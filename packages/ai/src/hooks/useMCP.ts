/**
 * RevealUI MCP React Hook
 * Provides MCP functionality in React components
 */

import { useCallback, useEffect, useState } from 'react'

import type { MCPConfig} from '../mcp/index.js';
import { RevealUIMCPClient } from '../mcp/index.js'

export interface UseMCPReturn {
	// Connection state
	isConnected: boolean
	isConnecting: boolean
	error: string | null

	// Vercel methods
	deployToVercel: (projectName: string, sourcePath: string) => Promise<any>
	listVercelProjects: () => Promise<any>

	// Stripe methods
	createPaymentIntent: (amount: number, currency?: string) => Promise<any>
	listStripeCustomers: () => Promise<any>

	// Generic tool calling
	callTool: (server: 'vercel' | 'stripe', toolName: string, args?: any) => Promise<any>
	listTools: (server: 'vercel' | 'stripe') => Promise<any[]>

	// Connection management
	connect: () => Promise<void>
	disconnect: () => Promise<void>
}

export function useMCP(config: MCPConfig): UseMCPReturn {
	const [client, setClient] = useState<RevealUIMCPClient | null>(null)
	const [isConnected, setIsConnected] = useState(false)
	const [isConnecting, setIsConnecting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const connect = useCallback(async () => {
		if (isConnected || isConnecting) return

		setIsConnecting(true)
		setError(null)

		try {
			const mcpClient = new RevealUIMCPClient(config)
			await mcpClient.initialize()
			setClient(mcpClient)
			setIsConnected(true)
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to connect to MCP servers'
			setError(errorMessage)
			console.error('MCP connection failed:', err)
		} finally {
			setIsConnecting(false)
		}
	}, [config, isConnected, isConnecting])

	const disconnect = useCallback(async () => {
		if (client) {
			try {
				await client.disconnect()
			} catch (err) {
				console.error('MCP disconnect failed:', err)
			}
		}
		setClient(null)
		setIsConnected(false)
		setError(null)
	}, [client])

	const deployToVercel = useCallback(async (projectName: string, sourcePath: string) => {
		if (!client) throw new Error('MCP client not connected')
		return client.deployToVercel(projectName, sourcePath)
	}, [client])

	const listVercelProjects = useCallback(async () => {
		if (!client) throw new Error('MCP client not connected')
		return client.listVercelProjects()
	}, [client])

	const createPaymentIntent = useCallback(async (amount: number, currency = 'usd') => {
		if (!client) throw new Error('MCP client not connected')
		return client.createPaymentIntent(amount, currency)
	}, [client])

	const listStripeCustomers = useCallback(async () => {
		if (!client) throw new Error('MCP client not connected')
		return client.listStripeCustomers()
	}, [client])

	const callTool = useCallback(async (server: 'vercel' | 'stripe', toolName: string, args = {}) => {
		if (!client) throw new Error('MCP client not connected')
		return client.callTool(server, toolName, args)
	}, [client])

	const listTools = useCallback(async (server: 'vercel' | 'stripe') => {
		if (!client) throw new Error('MCP client not connected')
		return client.listTools(server)
	}, [client])

	// Auto-connect on mount if config is provided
	useEffect(() => {
		if (Object.keys(config).length > 0 && !isConnected && !isConnecting) {
			connect()
		}

		// Cleanup on unmount
		return () => {
			if (isConnected) {
				disconnect()
			}
		}
	}, [config, connect, disconnect, isConnected, isConnecting])

	return {
		isConnected,
		isConnecting,
		error,
		deployToVercel,
		listVercelProjects,
		createPaymentIntent,
		listStripeCustomers,
		callTool,
		listTools,
		connect,
		disconnect
	}
}
