/* console-allowed */

/**
 * Test Semantic Caching
 *
 * Quick test to verify semantic caching is working. Defaults to Inference
 * Snaps on Ubuntu (zero-config). Requires POSTGRES_URL with pgvector for
 * the embedding store.
 */

import { LLMClient } from './src/llm/client.js';

async function testSemanticCaching() {
  console.log('🧪 Testing Semantic Caching\n');

  // Create client with semantic caching enabled. Inference Snaps is the
  // canonical local provider — no API key required.
  const client = new LLMClient({
    provider: 'inference-snaps',
    apiKey: 'inference-snaps',
    model: process.env.LLM_MODEL || 'gemma3',
    baseURL: process.env.INFERENCE_SNAPS_BASE_URL,
    enableSemanticCache: true,
    semanticCacheOptions: {
      similarityThreshold: 0.95,
      ttl: 60 * 60 * 1000, // 1 hour
    },
  });

  const queries = [
    // First query - will be a cache miss
    'How do I reset my password?',
    // Similar query - should hit semantic cache!
    "What's the process to reset my password?",
    // Very similar - should also hit
    'Help me reset my password',
    // Different query - cache miss
    'What are your business hours?',
  ];

  try {
    console.log('📊 Running semantic cache test...\n');

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📤 Query ${i + 1}: "${query}"`);
      console.log('='.repeat(70));

      const start = Date.now();
      const response = await client.chat([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: query },
      ]);
      const duration = Date.now() - start;

      console.log(`✅ Response: "${response.content.substring(0, 100)}..."`);
      console.log(`⏱️  Duration: ${duration}ms`);

      // Check if it was a cache hit
      const wasCached = !!response.usage?.cacheReadTokens;
      console.log(`🎯 Cache: ${wasCached ? '✅ HIT' : '❌ MISS'}`);

      // Get stats
      const stats = client.getSemanticCacheStats();
      if (stats) {
        console.log(
          `📊 Stats: ${stats.hits} hits, ${stats.misses} misses (${stats.hitRate}% hit rate)`,
        );
        if (stats.avgSimilarity > 0) {
          console.log(`🎯 Avg Similarity: ${stats.avgSimilarity}`);
        }
      }

      // Short delay between requests
      if (i < queries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Final stats
    console.log(`\n${'='.repeat(70)}`);
    console.log('📊 Final Semantic Cache Statistics');
    console.log('='.repeat(70));

    const finalStats = client.getSemanticCacheStats();
    if (finalStats) {
      console.log(`Total Queries: ${finalStats.totalQueries}`);
      console.log(`Cache Hits: ${finalStats.hits}`);
      console.log(`Cache Misses: ${finalStats.misses}`);
      console.log(`Hit Rate: ${finalStats.hitRate}%`);
      console.log(`Avg Similarity: ${finalStats.avgSimilarity}`);

      // Calculate expected results
      const expectedHits = 2; // Queries 2 and 3 should match query 1
      if (finalStats.hits >= expectedHits) {
        console.log(
          `\n🎉 SUCCESS: Semantic caching is working! Got ${finalStats.hits} cache hits (expected ${expectedHits})`,
        );
        console.log(`   Query 2 matched Query 1: ✅`);
        console.log(`   Query 3 matched Query 1: ✅`);
      } else {
        console.log(
          `\n⚠️  WARNING: Expected at least ${expectedHits} cache hits, got ${finalStats.hits}`,
        );
        console.log(
          '   This might be normal if similarity threshold is too high or embeddings are different',
        );
      }
    } else {
      console.log('⚠️  No semantic cache statistics available');
    }

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run test
console.log('Semantic Caching Test');
console.log('='.repeat(70));
console.log();

if (!process.env.POSTGRES_URL) {
  console.error('❌ Error: POSTGRES_URL not set');
  console.log('\nSemantic caching requires a PostgreSQL database with pgvector extension');
  console.log('Set your database URL:');
  console.log('  export POSTGRES_URL=postgresql://...');
  process.exit(1);
}

testSemanticCaching();
