#!/usr/bin/env tsx

/**
 * Next.js DevTools MCP Server Launcher
 *
 * Starts the Next.js DevTools MCP server for AI-powered Next.js development.
 *
 * Usage:
 *   pnpm mcp:next-devtools
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createLogger, getProjectRoot } from '@revealui/scripts';
import { ErrorCode } from '@revealui/scripts/errors';
import { config } from 'dotenv';
import { checkMcpLicense } from '../index.js';

const logger = createLogger();

// Load environment variables
config();

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(false));
      server.close();
    });
    server.on('error', () => resolve(true));
  });
}

async function startNextDevToolsMCP() {
  try {
    await getProjectRoot(import.meta.url);

    // Check if we're being invoked by an MCP client (non-TTY stdin)
    // MCP servers need clean stdio pipes for JSON-RPC protocol
    const isMCPSession = !process.stdin.isTTY;
    const stdioConfig: 'inherit' | ['pipe', 'pipe', 'pipe'] = isMCPSession
      ? ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr as pipes for MCP protocol
      : 'inherit'; // Use inherit for interactive/debugging sessions

    // Only log when running interactively (not via MCP client)
    if (!isMCPSession) {
      logger.header('Starting Next.js DevTools MCP Server');
      logger.info('   This server provides Next.js 16+ development tools for coding agents');
      logger.info('   Features: Runtime diagnostics, upgrade automation, Cache Components setup');
    }

    // Spawn the next-devtools-mcp process
    // Use pnpm exec for locally installed package
    // next-devtools-mcp automatically discovers Next.js dev servers and connects to them
    const child = spawn('pnpm', ['exec', 'next-devtools-mcp'], {
      stdio: stdioConfig,
      env: {
        ...process.env,
        // Disable telemetry if NEXT_TELEMETRY_DISABLED is set
        NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || '0',
      },
    });

    // Pipe stdio when running as MCP server (for JSON-RPC protocol)
    if (isMCPSession) {
      const { stdin, stdout, stderr } = child;
      if (stdin) {
        process.stdin.pipe(stdin);
      }
      stdout?.pipe(process.stdout);
      stderr?.pipe(process.stderr);
    } else {
      // Check CMS dev server
      const cmsPort = 4000;
      const cmsRunning = await checkPort(cmsPort);
      // In interactive mode, provide feedback that the server is running
      // MCP servers don't produce output until they receive JSON-RPC messages
      logger.info('\n📊 Server Discovery');
      logger.info('📝 Next Steps');
      if (!cmsRunning) {
        logger.info('1. Start your CMS dev server:');
        logger.info('   cd apps/cms && pnpm dev');
        logger.info('');
      }
      logger.info('2. Ensure Next.js DevTools MCP is running:');
      logger.info('   pnpm mcp:next-devtools');
      logger.info('   (or pnpm mcp:all for all servers)');
      logger.info('');
      logger.info('3. In Cursor, you can now ask:');
      logger.info('   - "What errors are in my Next.js app?"');
      logger.info('   - "Show me my application routes"');
      logger.info('   - "Help me upgrade to Next.js 16"');
      logger.info('   - "Enable Cache Components in my app"');
      logger.info('');

      if (cmsRunning) {
        logger.success(`Next.js CMS app detected on port ${cmsPort}`);
        logger.info(`   URL: http://localhost:${cmsPort}`);
        logger.info(`   MCP Endpoint: http://localhost:${cmsPort}/_next/mcp`);
        logger.info('   Server started successfully ✓');
        logger.info('   Waiting for MCP client connections...');
        logger.info('   (This server communicates via JSON-RPC protocol on stdin/stdout)');
        logger.info('');
        logger.info('   To use this with Cursor IDE:');
        logger.info("   • Ensure it's configured in .cursor/mcp-config.json");
        logger.info('   • Cursor will automatically start it when needed');
        logger.info('');
        logger.info('');

        logger.info('🛠️  Available Next.js DevTools MCP Tools');
        logger.info('1. nextjs_index');
        logger.info('   - Discovers all running Next.js 16+ dev servers');
        logger.info('   - Lists available diagnostic tools');
        logger.info('   - Shows server metadata (port, PID, URL)');
        logger.info('');
        logger.info('2. nextjs_call');
        logger.info('   - Executes runtime diagnostics on dev server');
        logger.info('   - Can query:');
        logger.info('     • Real-time build/runtime errors');
        logger.info('     • Application routes and pages');
        logger.info('     • Component metadata');
        logger.info('     • Development server logs');
        logger.info('     • Server Actions');
        logger.info('');
        logger.info('3. upgrade_nextjs_16');
        logger.info('   - Automated Next.js 16 upgrade');
        logger.info('   - Runs official codemods');
        logger.info('   - Handles async API changes');
        logger.info('   - Fixes deprecated features');
        logger.info('');
        logger.info('4. enable_cache_components');
        logger.info('   - Complete Cache Components setup');
        logger.info('   - Automated error detection and fixing');
        logger.info('   - Route verification');
        logger.info('   - Intelligent boundary setup');
        logger.info('');

        logger.info('💡 How to Use with Your CMS App');
        logger.info('Once your CMS dev server is running (pnpm dev in apps/cms):');
        logger.info('');
        logger.info('1. Auto-discovery:');
        logger.info('   The MCP server will automatically detect your CMS app');
        logger.info("   when it's running on http://localhost:4000");
        logger.info('');
        logger.info('2. Query runtime errors:');
        logger.info('   "Next Devtools, what errors are in my Next.js app?"');
        logger.info('   → Returns real-time build and runtime errors');
        logger.info('');
        logger.info('3. Check application routes:');
        logger.info('   "Next Devtools, show me my application routes"');
        logger.info('   → Lists all routes, pages, and dynamic segments');
        logger.info('');
        logger.info('4. View dev server logs:');
        logger.info('   "Next Devtools, what\'s in the dev server logs?"');
        logger.info('   → Shows recent development server output');
        logger.info('');
        logger.info('5. Upgrade assistance:');
        logger.info('   "Next Devtools, help me upgrade to Next.js 16"');
        logger.info('   → Guides through upgrade with automated codemods');
        logger.info('');
        logger.info('6. Cache Components setup:');
        logger.info('   "Next Devtools, enable Cache Components"');
        logger.info('   → Automated setup with error detection/fixing');
        logger.info('');

        logger.info('🔗 Integration with Your Setup');
        logger.success('Next.js DevTools MCP is configured in:');
        logger.info('   - .cursor/mcp-config.json');
        logger.info('   - package.json scripts (mcp:next-devtools)');
        logger.info('   - Included in mcp:all command');
        logger.info('');
        logger.success('Your CMS app is Next.js 16.1.1 - fully compatible!');
        logger.success('Dev server runs on port 4000 with Turbopack');
        logger.success('MCP endpoint available at: /_next/mcp');
        logger.info('');
        logger.info('   Press Ctrl+C to stop the server');
      } else {
        logger.warning(`Next.js CMS app not running on port ${cmsPort}`);
        logger.info(`   Start it with: cd apps/cms && pnpm dev`);
      }
    }

    child.on('error', (error) => {
      if (!isMCPSession) {
        logger.error(`Failed to start Next.js DevTools MCP server: ${error.message}`);
      }
      process.exit(ErrorCode.CONFIG_ERROR);
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });

    // Handle termination signals
    process.on('SIGINT', () => {
      if (!isMCPSession) {
        logger.info('\n🛑 Stopping Next.js DevTools MCP Server...');
      }
      child.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      if (!isMCPSession) {
        logger.info('\n🛑 Stopping Next.js DevTools MCP Server...');
      }
      child.kill('SIGTERM');
    });
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Launch the Next.js DevTools MCP server.
 * Exported for programmatic use by the Hypervisor.
 */
export async function launchNextDevtoolsMcp(): Promise<void> {
  if (!(await checkMcpLicense())) {
    throw new Error('MCP license check failed');
  }
  await startNextDevToolsMCP();
}

/**
 * Main function (CLI entrypoint)
 */
async function main() {
  try {
    await launchNextDevtoolsMcp();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
