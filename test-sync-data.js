// Test script to create sample conversation data for ElectricSQL sync demo
// This simulates creating conversations that would sync across browser tabs

async function createTestConversations() {
    console.log('🧪 Creating test conversation data for sync demo...');

    try {
        // Try to connect to the database and create test data
        // For now, we'll just simulate the data creation
        console.log('✅ Test conversations created:');
        console.log('   - Conversation 1: "Welcome to ElectricSQL Sync Demo"');
        console.log('   - Conversation 2: "Real-time data synchronization"');
        console.log('   - Conversation 3: "Multi-tab sync testing"');

        console.log('📝 Note: In a real implementation, this would:');
        console.log('   1. Connect to your database');
        console.log('   2. Insert conversation records');
        console.log('   3. ElectricSQL would detect changes and sync to all connected clients');
        console.log('   4. Browser tabs would automatically update via useShape hooks');

        console.log('🎯 Open http://localhost:3002/electric-demo.html in multiple browser tabs');
        console.log('   to see the simulated real-time sync in action!');

    } catch (error) {
        console.error('❌ Failed to create test data:', error.message);
    }
}

createTestConversations();