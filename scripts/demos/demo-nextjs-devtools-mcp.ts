#!/usr/bin/env tsx
/**
 * Demonstration script showing Next.js DevTools MCP capabilities
 * This shows what the MCP server can do with your Next.js 16 CMS app
 */

import { config } from "dotenv";
import { createLogger } from "../shared/utils.js";

config();

const logger = createLogger();

logger.header("Next.js DevTools MCP Demonstration");
logger.info("This script demonstrates what Next.js DevTools MCP can do\n");

// Function to check if a port is in use
import { createServer } from "node:net";

async function checkPort(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(port, () => {
			server.once("close", () => resolve(false));
			server.close();
		});
		server.on("error", () => resolve(true));
	});
}

// Check CMS dev server
const cmsPort = 4000;
const cmsRunning = await checkPort(cmsPort);

logger.info("\n📊 Server Discovery");
if (cmsRunning) {
	logger.success(`Next.js CMS app detected on port ${cmsPort}`);
	logger.info(`   URL: http://localhost:${cmsPort}`);
	logger.info(`   MCP Endpoint: http://localhost:${cmsPort}/_next/mcp`);
} else {
	logger.warning(`Next.js CMS app not running on port ${cmsPort}`);
	logger.info(`   Start it with: cd apps/cms && pnpm dev`);
}
logger.info("");

logger.info("🛠️  Available Next.js DevTools MCP Tools");
logger.info("1. nextjs_index");
logger.info("   - Discovers all running Next.js 16+ dev servers");
logger.info("   - Lists available diagnostic tools");
logger.info("   - Shows server metadata (port, PID, URL)");
logger.info("");
logger.info("2. nextjs_call");
logger.info("   - Executes runtime diagnostics on dev server");
logger.info("   - Can query:");
logger.info("     • Real-time build/runtime errors");
logger.info("     • Application routes and pages");
logger.info("     • Component metadata");
logger.info("     • Development server logs");
logger.info("     • Server Actions");
logger.info("");
logger.info("3. upgrade_nextjs_16");
logger.info("   - Automated Next.js 16 upgrade");
logger.info("   - Runs official codemods");
logger.info("   - Handles async API changes");
logger.info("   - Fixes deprecated features");
logger.info("");
logger.info("4. enable_cache_components");
logger.info("   - Complete Cache Components setup");
logger.info("   - Automated error detection and fixing");
logger.info("   - Route verification");
logger.info("   - Intelligent boundary setup");
logger.info("");

logger.info("💡 How to Use with Your CMS App");
logger.info("Once your CMS dev server is running (pnpm dev in apps/cms):");
logger.info("");
logger.info("1. Auto-discovery:");
logger.info("   The MCP server will automatically detect your CMS app");
logger.info("   when it's running on http://localhost:4000");
logger.info("");
logger.info("2. Query runtime errors:");
logger.info('   "Next Devtools, what errors are in my Next.js app?"');
logger.info("   → Returns real-time build and runtime errors");
logger.info("");
logger.info("3. Check application routes:");
logger.info('   "Next Devtools, show me my application routes"');
logger.info("   → Lists all routes, pages, and dynamic segments");
logger.info("");
logger.info("4. View dev server logs:");
logger.info('   "Next Devtools, what\'s in the dev server logs?"');
logger.info("   → Shows recent development server output");
logger.info("");
logger.info("5. Upgrade assistance:");
logger.info('   "Next Devtools, help me upgrade to Next.js 16"');
logger.info("   → Guides through upgrade with automated codemods");
logger.info("");
logger.info("6. Cache Components setup:");
logger.info('   "Next Devtools, enable Cache Components"');
logger.info("   → Automated setup with error detection/fixing");
logger.info("");

logger.info("🔗 Integration with Your Setup");
logger.success("Next.js DevTools MCP is configured in:");
logger.info("   - .cursor/mcp-config.json");
logger.info("   - package.json scripts (mcp:next-devtools)");
logger.info("   - Included in mcp:all command");
logger.info("");
logger.success("Your CMS app is Next.js 16.1.1 - fully compatible!");
logger.success("Dev server runs on port 4000 with Turbopack");
logger.success("MCP endpoint available at: /_next/mcp");
logger.info("");

logger.info("📝 Next Steps");
if (!cmsRunning) {
	logger.info("1. Start your CMS dev server:");
	logger.info("   cd apps/cms && pnpm dev");
	logger.info("");
}
logger.info("2. Ensure Next.js DevTools MCP is running:");
logger.info("   pnpm mcp:next-devtools");
logger.info("   (or pnpm mcp:all for all servers)");
logger.info("");
logger.info("3. In Cursor, you can now ask:");
logger.info('   - "What errors are in my Next.js app?"');
logger.info('   - "Show me my application routes"');
logger.info('   - "Help me upgrade to Next.js 16"');
logger.info('   - "Enable Cache Components in my app"');
logger.info("");
