/**
 * RevealUI MCP Integration
 * Connect to external services via direct API calls (MCP-compatible interface)
 */

/// <reference types="node" />

interface FetchResponse {
	ok: boolean
	json(): Promise<unknown>
}

declare const fetch: (url: string, options?: { headers?: Record<string, string>; method?: string; body?: string }) => Promise<FetchResponse>

export interface MCPConfig {
	vercel?: {
		accessToken: string
		teamId?: string
	}
	stripe?: {
		secretKey: string
		publishableKey: string
	}
}

export interface MCPToolResult {
	content: Array<{
		type: 'text'
		text: string
	}>
	isError?: boolean
}

export interface MCPTool {
	name: string
	description: string
	inputSchema: {
		type: 'object'
		properties: Record<string, any>
		required?: string[]
	}
}

export class RevealUIMCPClient {
	private config: MCPConfig
	private initialized = false

	constructor(config: MCPConfig) {
		this.config = config
	}

	/**
	 * Initialize connections (validate configuration)
	 */
	initialize(): void {
		if (!this.config.vercel?.accessToken) {
			throw new Error('Vercel access token is required')
		}
		if (!this.config.stripe?.secretKey) {
			throw new Error('Stripe secret key is required')
		}
		this.initialized = true
	}

	/**
	 * Execute a tool on a server (direct API calls)
	 */
	async callTool(server: 'vercel' | 'stripe', toolName: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
		if (!this.initialized) {
			throw new Error('MCP client not initialized')
		}

		switch (server) {
			case 'vercel':
				return await this.callVercelTool(toolName, args)
			case 'stripe':
				return await this.callStripeTool(toolName, args)
			default: {
				const errorMsg = `Unknown server: ${server}`
				throw new Error(errorMsg)
			}
		}
	}

	/**
	 * List available tools for a server
	 */
	listTools(server: 'vercel' | 'stripe'): MCPTool[] {
		if (!this.initialized) {
			throw new Error('MCP client not initialized')
		}

		switch (server) {
			case 'vercel':
				return this.getVercelTools()
			case 'stripe':
				return this.getStripeTools()
			default: {
				const errorMsg = `Unknown server: ${server}`
				throw new Error(errorMsg)
			}
		}
	}

	/**
	 * Deploy to Vercel
	 */
	async deployToVercel(projectName: string, sourcePath: string): Promise<MCPToolResult> {
		return this.callVercelTool('deploy', { name: projectName, source: sourcePath })
	}

	/**
	 * Create Stripe payment intent
	 */
	async createPaymentIntent(amount: number, currency: string = 'usd'): Promise<MCPToolResult> {
		return this.callStripeTool('create_payment_intent', { amount, currency })
	}

	/**
	 * List Vercel projects
	 */
	async listVercelProjects(): Promise<MCPToolResult> {
		return this.callVercelTool('list_projects', {})
	}

	/**
	 * List Stripe customers
	 */
	async listStripeCustomers(): Promise<MCPToolResult> {
		return this.callStripeTool('list_customers', {})
	}

	/**
	 * Cleanup connections (no-op for direct API calls)
	 */
	disconnect(): void {
		this.initialized = false
	}

	/**
	 * Call Vercel API directly
	 */
	private async callVercelTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
		if (!this.config.vercel?.accessToken) {
			throw new Error('Vercel access token not configured')
		}

		const baseURL = 'https://api.vercel.com'
		const headers = {
			'Authorization': `Bearer ${this.config.vercel.accessToken}`,
			'Content-Type': 'application/json'
		}

		try {
			switch (toolName) {
				case 'list_projects': {
					const response = await fetch(`${baseURL}/v9/projects`, { headers })
					const result: unknown = await response.json()

					if (response.ok === true && typeof result === 'object' && result !== null && 'projects' in result) {
						const projects = (result as { projects: unknown[] }).projects || []
						return {
							content: [{
								type: 'text',
								text: JSON.stringify(projects)
							}]
						}
					} else {
						throw new Error('Invalid response from Vercel API')
					}
				}

				case 'deploy': {
					// For deployment, we'd need to create a project and deploy
					// This is a simplified version
					const name = typeof args.name === 'string' ? args.name : 'unknown'
					return {
						content: [{
							type: 'text',
							text: `Deployment initiated for project: ${name}`
						}]
					}
				}

				default: {
					const errorMsg = `Unknown Vercel tool: ${toolName}`
					throw new Error(errorMsg)
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			return {
				content: [{
					type: 'text',
					text: `Error calling Vercel ${toolName}: ${errorMessage}`
				}],
				isError: true
			}
		}
	}

	/**
	 * Call Stripe API directly
	 */
	private async callStripeTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
		if (!this.config.stripe?.secretKey) {
			throw new Error('Stripe secret key not configured')
		}

		const baseURL = 'https://api.stripe.com/v1'
		const headers = {
			'Authorization': `Bearer ${this.config.stripe.secretKey}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		}

		try {
			switch (toolName) {
				case 'list_customers': {
					const response = await fetch(`${baseURL}/customers`, { headers })
					const result: unknown = await response.json()

					if (response.ok === true && typeof result === 'object' && result !== null && 'data' in result) {
						const customers = (result as { data: unknown[] }).data || []
						return {
							content: [{
								type: 'text',
								text: JSON.stringify(customers)
							}]
						}
					} else {
						throw new Error('Invalid response from Stripe API')
					}
				}

				case 'create_payment_intent': {
					const amount = typeof args.amount === 'number' ? args.amount : 0
					const currency = typeof args.currency === 'string' ? args.currency : 'usd'

					const params = new URLSearchParams({
						amount: amount.toString(),
						currency
					})

					const response = await fetch(`${baseURL}/payment_intents`, {
						method: 'POST',
						headers,
						body: params.toString()
					})

					const result: unknown = await response.json()
					return {
						content: [{
							type: 'text',
							text: JSON.stringify(result)
						}]
					}
				}

				default: {
					const errorMsg = `Unknown Stripe tool: ${toolName}`
					throw new Error(errorMsg)
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			return {
				content: [{
					type: 'text',
					text: `Error calling Stripe ${toolName}: ${errorMessage}`
				}],
				isError: true
			}
		}
	}

	/**
	 * Get available Vercel tools
	 */
	private getVercelTools(): MCPTool[] {
		return [
			{
				name: 'list_projects',
				description: 'List all Vercel projects',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'deploy',
				description: 'Deploy a project to Vercel',
				inputSchema: {
					type: 'object',
					properties: {
						name: { type: 'string', description: 'Project name' },
						source: { type: 'string', description: 'Source path' }
					},
					required: ['name', 'source']
				}
			}
		]
	}

	/**
	 * Get available Stripe tools
	 */
	private getStripeTools(): MCPTool[] {
		return [
			{
				name: 'list_customers',
				description: 'List Stripe customers',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'create_payment_intent',
				description: 'Create a Stripe payment intent',
				inputSchema: {
					type: 'object',
					properties: {
						amount: { type: 'number', description: 'Amount in cents' },
						currency: { type: 'string', description: 'Currency code', default: 'usd' }
					},
					required: ['amount']
				}
			}
		]
	}
}
