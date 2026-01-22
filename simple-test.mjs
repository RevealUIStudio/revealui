// Simple test to verify ESM execution works
console.log('🚀 Simple test starting...')

const { execSync } = await import('child_process')
const { resolve, dirname } = await import('path')
const { fileURLToPath } = await import('url')

console.log('✅ Imports successful')

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '')
console.log('📁 Project root:', projectRoot)

console.log('🎯 Test completed successfully!')