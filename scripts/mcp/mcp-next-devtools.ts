#!/usr/bin/env tsx
/**
 * Next.js DevTools MCP Server Launcher
 *
 * Starts the Next.js DevTools MCP server for AI-powered Next.js development.
 *
 * Usage:
 *   pnpm mcp:next-devtools
 */

import { spawn } from "node:child_process";
import { config } from "dotenv";
import { createLogger, getProjectRoot } from "../shared/utils.js";

const logger = createLogger();

// Load environment variables
config();

async function startNextDevToolsMCP() {
	try {
		await getProjectRoot(import.meta.url);

		// Check if we're being invoked by an MCP client (non-TTY stdin)
		// MCP servers need clean stdio pipes for JSON-RPC protocol
		const isMCPSession = !process.stdin.isTTY;
		const stdioConfig: "inherit" | ["pipe", "pipe", "pipe"] = isMCPSession
			? ["pipe", "pipe", "pipe"] // stdin, stdout, stderr as pipes for MCP protocol
			: "inherit"; // Use inherit for interactive/debugging sessions

		// Only log when running interactively (not via MCP client)
		if (!isMCPSession) {
			logger.header("Starting Next.js DevTools MCP Server");
			logger.info(
				"   This server provides Next.js 16+ development tools for coding agents",
			);
			logger.info(
				"   Features: Runtime diagnostics, upgrade automation, Cache Components setup",
			);
		}

		// Spawn the next-devtools-mcp process
		// Use pnpm exec for locally installed package
		// next-devtools-mcp automatically discovers Next.js dev servers and connects to them
		const child = spawn("pnpm", ["exec", "next-devtools-mcp"], {
			stdio: stdioConfig,
			env: {
				...process.env,
				// Disable telemetry if NEXT_TELEMETRY_DISABLED is set
				NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "0",
			},
		});

		// Pipe stdio when running as MCP server (for JSON-RPC protocol)
		if (isMCPSession) {
			process.stdin.pipe(child.stdin!);
			child.stdout!.pipe(process.stdout);
			child.stderr!.pipe(process.stderr);
		} else {
			// In interactive mode, provide feedback that the server is running
			// MCP servers don't produce output until they receive JSON-RPC messages
			logger.info("   Server started successfully ✓");
			logger.info("   Waiting for MCP client connections...");
			logger.info(
				"   (This server communicates via JSON-RPC protocol on stdin/stdout)",
			);
			logger.info("");
			logger.info("   To use this with Cursor IDE:");
			logger.info("   • Ensure it's configured in .cursor/mcp-config.json");
			logger.info("   • Cursor will automatically start it when needed");
			logger.info("");
			logger.info("   Press Ctrl+C to stop the server");
		}

		child.on("error", (error) => {
			if (!isMCPSession) {
				logger.error(
					`Failed to start Next.js DevTools MCP server: ${error.message}`,
				);
			}
			process.exit(1);
		});

		child.on("exit", (code) => {
			process.exit(code ?? 0);
		});

		// Handle termination signals
		process.on("SIGINT", () => {
			if (!isMCPSession) {
				logger.info("\n🛑 Stopping Next.js DevTools MCP Server...");
			}
			child.kill("SIGINT");
		});

		process.on("SIGTERM", () => {
			if (!isMCPSession) {
				logger.info("\n🛑 Stopping Next.js DevTools MCP Server...");
			}
			child.kill("SIGTERM");
		});
	} catch (error) {
		logger.error(
			`Script failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}

/**
 * Main function
 */
async function main() {
	try {
		await startNextDevToolsMCP();
	} catch (error) {
		logger.error(
			`Script failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}

main();
