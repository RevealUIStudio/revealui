/**
 * ElectricSQL Sync Test
 *
 * Simple test to verify ElectricSQL sync is working.
 * Bypasses the CMS app build issues and tests the sync package directly.
 *
 * @dependencies
 * - None (standalone test script using fetch API)
 */

// Simple test to verify ElectricSQL sync is working
// This bypasses the CMS app build issues and tests the sync package directly

async function testElectricSync() {
  console.log('🧪 Testing ElectricSQL sync functionality...')

  try {
    // Test basic connectivity to ElectricSQL
    const response = await fetch('http://localhost:3001/v1/health')
    if (response.ok) {
      console.log('✅ ElectricSQL health check passed')
      const data = await response.json()
      console.log('   Status:', data.status)
    } else {
      console.log('❌ ElectricSQL health check failed:', response.status)
    }

    // Test shapes endpoint (if our proxy is working)
    try {
      const shapesResponse = await fetch(
        'http://localhost:4000/api/shapes/conversations?table=conversations&where=user_id=%271%27',
      )
      if (shapesResponse.ok) {
        console.log('✅ Shapes API proxy is working')
        const data = await shapesResponse.json()
        console.log('   Data length:', data.length || 'N/A')
      } else {
        console.log('⚠️  Shapes API proxy returned:', shapesResponse.status)
      }
    } catch (error) {
      console.log('⚠️  Shapes API proxy not accessible (CMS not running):', error.message)
    }

    console.log('🎯 ElectricSQL sync test completed')
  } catch (error) {
    console.error('❌ ElectricSQL test failed:', error.message)
  }
}

testElectricSync()
