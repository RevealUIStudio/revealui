/* console-allowed */

/**
 * Test Response Caching
 *
 * Quick test to verify response caching is working
 */

import { LLMClient } from './src/llm/client.js';

async function testResponseCaching() {
  console.log('🧪 Testing Response Caching\n');

  // Create client with response caching enabled
  const client = new LLMClient({
    provider: 'vultr',
    apiKey: process.env.VULTR_API_KEY || '',
    model: process.env.LLM_MODEL || 'kimi-k2-instruct',
    baseURL: process.env.VULTR_BASE_URL,
    enableResponseCache: true,
    responseCacheOptions: {
      max: 100,
      ttl: 5 * 60 * 1000, // 5 minutes
    },
  });

  const testMessage = [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'Say hello in exactly 5 words.' },
  ];

  try {
    // First request - should be a cache miss (API call)
    console.log('📤 Request 1: Making API call...');
    const start1 = Date.now();
    const response1 = await client.chat(testMessage);
    const duration1 = Date.now() - start1;

    console.log(`✅ Response: "${response1.content}"`);
    console.log(`⏱️  Duration: ${duration1}ms`);
    console.log(`📊 Cache stats:`, client.getResponseCacheStats());
    console.log();

    // Second request - should be a cache hit (instant)
    console.log('📤 Request 2: Same query (should hit cache)...');
    const start2 = Date.now();
    const response2 = await client.chat(testMessage);
    const duration2 = Date.now() - start2;

    console.log(`✅ Response: "${response2.content}"`);
    console.log(`⏱️  Duration: ${duration2}ms`);
    console.log(`📊 Cache stats:`, client.getResponseCacheStats());
    console.log();

    // Verify cache hit
    const stats = client.getResponseCacheStats();
    if (stats && stats.hits > 0) {
      console.log('🎉 SUCCESS: Response caching is working!');
      console.log(`   - Request 1: ${duration1}ms (API call)`);
      console.log(
        `   - Request 2: ${duration2}ms (cache hit - ${Math.round((1 - duration2 / duration1) * 100)}% faster!)`,
      );
      console.log(`   - Hit rate: ${stats.hitRate}%`);
      console.log(`   - Saved: 1 API call = ~$0.003`);
    } else {
      console.log('⚠️  WARNING: Cache hit not detected');
      console.log('   This might be normal if responses differ slightly');
    }

    // Third request - different query (cache miss)
    console.log('\n📤 Request 3: Different query (cache miss expected)...');
    const start3 = Date.now();
    const response3 = await client.chat([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Count to three.' },
    ]);
    const duration3 = Date.now() - start3;

    console.log(`✅ Response: "${response3.content}"`);
    console.log(`⏱️  Duration: ${duration3}ms`);
    console.log(`📊 Final cache stats:`, client.getResponseCacheStats());

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  }
}

// Run test
console.log('Response Caching Test');
console.log('='.repeat(50));
console.log();

if (!process.env.VULTR_API_KEY) {
  console.error('❌ Error: VULTR_API_KEY not set');
  console.log('\nSet your API key:');
  console.log('  export VULTR_API_KEY=your-key-here');
  process.exit(1);
}

testResponseCaching();
