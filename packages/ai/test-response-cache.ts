/* console-allowed */

/**
 * Test Response Caching
 *
 * Quick test to verify response caching is working. Defaults to Inference
 * Snaps on Ubuntu (zero-config); override via INFERENCE_SNAPS_BASE_URL
 * if the snap listens on a non-default port, or set LLM_PROVIDER + the
 * matching env vars to use a different provider (groq, huggingface, ollama).
 */

import { LLMClient } from './src/llm/client.js';

async function testResponseCaching() {
  console.log('🧪 Testing Response Caching\n');

  // Create client with response caching enabled. Inference Snaps is the
  // canonical local provider — no API key required.
  const client = new LLMClient({
    provider: 'inference-snaps',
    apiKey: 'inference-snaps',
    model: process.env.LLM_MODEL || 'gemma3',
    baseURL: process.env.INFERENCE_SNAPS_BASE_URL,
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
      console.error(
        '\n   Hint: Inference Snaps must be reachable at',
        process.env.INFERENCE_SNAPS_BASE_URL ?? 'http://localhost:9090/v1',
      );
      console.error('   Install: sudo snap install gemma3 (or your model of choice).');
    }
    process.exit(1);
  }
}

// Run test
console.log('Response Caching Test');
console.log('='.repeat(50));
console.log();

testResponseCaching();
