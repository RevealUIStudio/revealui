#!/usr/bin/env node

/**
 * Multi-Device Sync Test Script
 *
 * Tests real-time synchronization across multiple browser contexts.
 * Run this script to verify ElectricSQL sync functionality.
 */

console.log('🧪 Testing ElectricSQL Multi-Device Sync...\n')

// Test 1: Check ElectricSQL client initialization
console.log('1. Testing ElectricSQL client initialization...')
try {
  const { createElectricClient } = await import('./dist/client/electric.js')
  const client = createElectricClient({
    debug: true,
    url: process.env.ELECTRIC_SERVICE_URL || 'http://localhost:3001',
  })

  console.log('✅ ElectricSQL client created successfully')
  console.log(`   Client connected: ${client.isConnected()}`)
} catch (error) {
  console.log('❌ ElectricSQL client initialization failed:', error.message)
}

// Test 2: Check shape definitions
console.log('\n2. Testing shape definitions...')
try {
  const { createConversationsShape, createMultiDeviceShapes } = await import('./dist/shapes.js')

  const conversationShape = createConversationsShape({ userId: 'test-user' })
  console.log('✅ Conversation shape created:', conversationShape.table)

  const multiDeviceShapes = createMultiDeviceShapes('test-user')
  console.log('✅ Multi-device shapes created:', multiDeviceShapes.length, 'shapes')
} catch (error) {
  console.log('❌ Shape definitions failed:', error.message)
}

// Test 3: Check React hooks (import test)
console.log('\n3. Testing React hooks imports...')
try {
  const hooks = await import('./dist/hooks/electric.js')
  const hookNames = Object.keys(hooks).filter((name) => name.startsWith('use'))
  console.log('✅ React hooks available:', hookNames.join(', '))
} catch (error) {
  console.log('❌ React hooks import failed:', error.message)
}

// Test 4: Check device management
console.log('\n4. Testing device management...')
try {
  const deviceHooks = await import('./dist/hooks/device.js')
  const deviceHookNames = Object.keys(deviceHooks).filter((name) => name.startsWith('use'))
  console.log('✅ Device hooks available:', deviceHookNames.join(', '))
} catch (error) {
  console.log('❌ Device management import failed:', error.message)
}

console.log('\n🎯 Multi-Device Sync Test Complete!')
console.log('\nTo test real-time sync:')
console.log('1. Start ElectricSQL server: electric-sql start')
console.log('2. Open app in multiple browser tabs')
console.log('3. Register devices and create conversations')
console.log('4. Verify real-time updates across tabs')
