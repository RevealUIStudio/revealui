#!/usr/bin/env tsx

/**
 * Test Next.js MCP Endpoint
 *
 * Verifies that the Next.js MCP endpoint is accessible when the dev server is running.
 * This tests the Next.js DevTools MCP integration.
 *
 * Usage:
 *   pnpm tsx scripts/validation/test-nextjs-mcp-endpoint.ts
 */

import { createLogger } from "../shared/utils.js";

const logger = createLogger();

const CMS_PORT = 4000;
const MCP_ENDPOINT = `http://localhost:${CMS_PORT}/_next/mcp`;

async function checkServer(
	port: number,
): Promise<{ running: boolean; statusCode?: number }> {
	try {
		const response = await fetch(`http://localhost:${port}`, {
			method: "GET",
			signal: AbortSignal.timeout(2000),
		});
		return { running: true, statusCode: response.status };
	} catch (error) {
		return { running: false };
	}
}

async function checkMCPEndpoint(): Promise<{
	accessible: boolean;
	content?: string;
}> {
	try {
		const response = await fetch(MCP_ENDPOINT, {
			method: "GET",
			signal: AbortSignal.timeout(2000),
		});

		if (response.ok) {
			const content = await response.text();
			return { accessible: true, content };
		}
		return { accessible: false };
	} catch (error) {
		return { accessible: false };
	}
}

async function testMCPEndpoint() {
	logger.header("Testing Next.js MCP Endpoint Discovery");
	logger.info("");

	// Step 1: Check if CMS dev server is running
	logger.info(
		`1. Checking if CMS dev server is running on port ${CMS_PORT}...`,
	);
	const serverStatus = await checkServer(CMS_PORT);

	if (
		serverStatus.running &&
		(serverStatus.statusCode === 200 || serverStatus.statusCode === 404)
	) {
		logger.success(`   Server is running (HTTP ${serverStatus.statusCode})`);

		// Step 2: Check MCP endpoint
		logger.info("");
		logger.info("2. Checking Next.js MCP endpoint...");
		const mcpStatus = await checkMCPEndpoint();

		if (mcpStatus.accessible) {
			logger.success("   MCP endpoint is accessible");
			logger.info("");
			logger.info("3. Fetching MCP server info...");
			if (mcpStatus.content) {
				// Show first 20 lines or first 1000 characters
				const preview = mcpStatus.content.split("\n").slice(0, 20).join("\n");
				logger.info(preview);
				if (mcpStatus.content.length > preview.length) {
					logger.info(
						`   ... (${mcpStatus.content.length - preview.length} more characters)`,
					);
				}
			}
		} else {
			logger.warning("   MCP endpoint not accessible");
			logger.info("   This is normal if Next.js < 16 or endpoint disabled");
		}
	} else if (serverStatus.running) {
		logger.error(
			`   Server not responding correctly (HTTP ${serverStatus.statusCode})`,
		);
	} else {
		logger.error(`   Dev server not running on port ${CMS_PORT}`);
		logger.info("");
		logger.info("   To start it:");
		logger.info("   cd apps/cms && pnpm dev");
	}

	logger.info("");
	logger.info("=".repeat(60));
	logger.info("");
	logger.info("📝 Next.js DevTools MCP Tools Available:");
	logger.info("   • nextjs_index - Discover running servers");
	logger.info("   • nextjs_call - Execute diagnostic tools");
	logger.info("   • upgrade_nextjs_16 - Automated upgrade");
	logger.info("   • enable_cache_components - Cache Components setup");
	logger.info("");
}

/**
 * Main function
 */
async function main() {
	try {
		await testMCPEndpoint();
	} catch (error) {
		logger.error(
			`Script failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		if (error instanceof Error && error.stack) {
			logger.error(`Stack trace: ${error.stack}`);
		}
		process.exit(1);
	}
}

main();
