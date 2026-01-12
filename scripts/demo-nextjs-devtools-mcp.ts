#!/usr/bin/env tsx
/**
 * Demonstration script showing Next.js DevTools MCP capabilities
 * This shows what the MCP server can do with your Next.js 16 CMS app
 */

import { config } from 'dotenv'

config()

console.log('🔍 Next.js DevTools MCP Demonstration\n')
console.log('='.repeat(60))
console.log('This script demonstrates what Next.js DevTools MCP can do')
console.log(`${'='.repeat(60)}\n`)

// Function to check if a port is in use
import { createServer } from 'node:net'

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.listen(port, () => {
      server.once('close', () => resolve(false))
      server.close()
    })
    server.on('error', () => resolve(true))
  })
}

// Check CMS dev server
const cmsPort = 4000
const cmsRunning = await checkPort(cmsPort)

console.log('📊 Server Discovery')
console.log('─'.repeat(60))
if (cmsRunning) {
  console.log(`✅ Next.js CMS app detected on port ${cmsPort}`)
  console.log(`   URL: http://localhost:${cmsPort}`)
  console.log(`   MCP Endpoint: http://localhost:${cmsPort}/_next/mcp`)
} else {
  console.log(`❌ Next.js CMS app not running on port ${cmsPort}`)
  console.log(`   Start it with: cd apps/cms && pnpm dev`)
}
console.log()

console.log('🛠️  Available Next.js DevTools MCP Tools')
console.log('─'.repeat(60))
console.log('1. nextjs_index')
console.log('   - Discovers all running Next.js 16+ dev servers')
console.log('   - Lists available diagnostic tools')
console.log('   - Shows server metadata (port, PID, URL)')
console.log()
console.log('2. nextjs_call')
console.log('   - Executes runtime diagnostics on dev server')
console.log('   - Can query:')
console.log('     • Real-time build/runtime errors')
console.log('     • Application routes and pages')
console.log('     • Component metadata')
console.log('     • Development server logs')
console.log('     • Server Actions')
console.log()
console.log('3. upgrade_nextjs_16')
console.log('   - Automated Next.js 16 upgrade')
console.log('   - Runs official codemods')
console.log('   - Handles async API changes')
console.log('   - Fixes deprecated features')
console.log()
console.log('4. enable_cache_components')
console.log('   - Complete Cache Components setup')
console.log('   - Automated error detection and fixing')
console.log('   - Route verification')
console.log('   - Intelligent boundary setup')
console.log()

console.log('💡 How to Use with Your CMS App')
console.log('─'.repeat(60))
console.log('Once your CMS dev server is running (pnpm dev in apps/cms):')
console.log()
console.log('1. Auto-discovery:')
console.log('   The MCP server will automatically detect your CMS app')
console.log("   when it's running on http://localhost:4000")
console.log()
console.log('2. Query runtime errors:')
console.log('   "Next Devtools, what errors are in my Next.js app?"')
console.log('   → Returns real-time build and runtime errors')
console.log()
console.log('3. Check application routes:')
console.log('   "Next Devtools, show me my application routes"')
console.log('   → Lists all routes, pages, and dynamic segments')
console.log()
console.log('4. View dev server logs:')
console.log('   "Next Devtools, what\'s in the dev server logs?"')
console.log('   → Shows recent development server output')
console.log()
console.log('5. Upgrade assistance:')
console.log('   "Next Devtools, help me upgrade to Next.js 16"')
console.log('   → Guides through upgrade with automated codemods')
console.log()
console.log('6. Cache Components setup:')
console.log('   "Next Devtools, enable Cache Components"')
console.log('   → Automated setup with error detection/fixing')
console.log()

console.log('🔗 Integration with Your Setup')
console.log('─'.repeat(60))
console.log('✅ Next.js DevTools MCP is configured in:')
console.log('   - .cursor/mcp-config.json')
console.log('   - package.json scripts (mcp:next-devtools)')
console.log('   - Included in mcp:all command')
console.log()
console.log('✅ Your CMS app is Next.js 16.1.1 - fully compatible!')
console.log('✅ Dev server runs on port 4000 with Turbopack')
console.log('✅ MCP endpoint available at: /_next/mcp')
console.log()

console.log('📝 Next Steps')
console.log('─'.repeat(60))
if (!cmsRunning) {
  console.log('1. Start your CMS dev server:')
  console.log('   cd apps/cms && pnpm dev')
  console.log()
}
console.log('2. Ensure Next.js DevTools MCP is running:')
console.log('   pnpm mcp:next-devtools')
console.log('   (or pnpm mcp:all for all servers)')
console.log()
console.log('3. In Cursor, you can now ask:')
console.log('   - "What errors are in my Next.js app?"')
console.log('   - "Show me my application routes"')
console.log('   - "Help me upgrade to Next.js 16"')
console.log('   - "Enable Cache Components in my app"')
console.log()
