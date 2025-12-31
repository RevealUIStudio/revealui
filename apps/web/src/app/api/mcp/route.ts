/**
 * RevealUI MCP API Route
 * Handles MCP requests from the frontend
 */

/// <reference types="node" />

declare const process: {
	env: Record<string, string | undefined>
}

declare const console: {
	error: (...args: unknown[]) => void
}

import { NextRequest, NextResponse } from 'next/server'
import { RevealUIMCPClient } from '@revealui/ai'
import type { MCPConfig, MCPToolResult } from '@revealui/ai'

let mcpClient: RevealUIMCPClient | null = null

async function getMCPClient(): Promise<RevealUIMCPClient> {
	if (!mcpClient) {
		// Get environment variables safely
		const vercelAccessToken = process.env.VERCEL_ACCESS_TOKEN
		const vercelTeamId = process.env.VERCEL_TEAM_ID
		const stripeSecretKey = process.env.STRIPE_SECRET_KEY
		const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY

		if (!vercelAccessToken || !stripeSecretKey || !stripePublishableKey) {
			throw new Error('Missing required environment variables: VERCEL_ACCESS_TOKEN, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY')
		}

		const config: MCPConfig = {
			vercel: {
				accessToken: vercelAccessToken,
				teamId: vercelTeamId
			},
			stripe: {
				secretKey: stripeSecretKey,
				publishableKey: stripePublishableKey
			}
		}

		mcpClient = new RevealUIMCPClient(config)
		try {
			await mcpClient.initialize()
		} catch (error) {
			console.error('Failed to initialize MCP client:', error)
			throw new Error('Failed to initialize MCP connections')
		}
	}

	return mcpClient
}

interface MCPRequestBody {
	action: string
	server: 'vercel' | 'stripe'
	toolName?: string
	args?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json() as MCPRequestBody
		const { action, server, toolName, args } = body

		if (!action || !server) {
			return NextResponse.json(
				{ error: 'Missing required fields: action, server' },
				{ status: 400 }
			)
		}

		const client = await getMCPClient()
		let result: MCPToolResult

		switch (action) {
			case 'callTool': {
				if (!toolName) {
					return NextResponse.json(
						{ error: 'toolName is required for callTool action' },
						{ status: 400 }
					)
				}
				result = await client.callTool(server, toolName, args)
				break
			}

			case 'listTools': {
				const tools = await client.listTools(server)
				return NextResponse.json({ success: true, data: tools })
			}

			case 'deployToVercel': {
				const { projectName, sourcePath } = args as { projectName?: string; sourcePath?: string }
				if (!projectName || !sourcePath) {
					return NextResponse.json(
						{ error: 'projectName and sourcePath are required for deployToVercel' },
						{ status: 400 }
					)
				}
				result = await client.deployToVercel(projectName, sourcePath)
				break
			}

			case 'createPaymentIntent': {
				const { amount, currency } = args as { amount?: number; currency?: string }
				if (typeof amount !== 'number') {
					return NextResponse.json(
						{ error: 'amount must be a number for createPaymentIntent' },
						{ status: 400 }
					)
				}
				result = await client.createPaymentIntent(amount, currency ?? 'usd')
				break
			}

			case 'listVercelProjects': {
				result = await client.listVercelProjects()
				break
			}

			case 'listStripeCustomers': {
				result = await client.listStripeCustomers()
				break
			}

			default: {
				return NextResponse.json(
					{ error: `Unknown action: ${action}` },
					{ status: 400 }
				)
			}
		}

		return NextResponse.json({ success: true, data: result })

	} catch (error) {
		console.error('MCP API error:', error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}

export async function GET() {
	try {
		const client = await getMCPClient()
		const vercelTools = await client.listTools('vercel').catch(() => [])
		const stripeTools = await client.listTools('stripe').catch(() => [])

		return NextResponse.json({
			success: true,
			tools: {
				vercel: vercelTools,
				stripe: stripeTools
			}
		})
	} catch (error) {
		console.error('MCP tools listing error:', error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to list tools'
			},
			{ status: 500 }
		)
	}
}
