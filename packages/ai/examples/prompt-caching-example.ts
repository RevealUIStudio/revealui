/**
 * Prompt Caching Examples
 *
 * Demonstrates cost savings from Anthropic prompt caching in real-world scenarios
 */

import {
  cacheableSystemPrompt,
  calculateCacheCost,
  createCachedConversation,
  estimateCacheSavings,
  formatCacheStats,
} from '../src/llm/cache-utils.js';
import { LLMClient } from '../src/llm/client.js';

// Example 1: Agent with Tools
async function _agentWithToolsExample() {
  console.log('=== Example 1: Agent with Tools ===\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const client = new LLMClient({
    provider: 'anthropic',
    apiKey,
    model: 'claude-3-5-sonnet-20241022',
    enableCacheByDefault: true,
  });

  // Large system prompt + tool definitions (~3000 tokens)
  const systemPrompt = `You are an expert software engineer specialized in TypeScript and React.

You have access to various development tools:
- File operations (read, write, search)
- Code analysis (lint, format, test)
- Git operations (commit, branch, diff)
- Package management (install, update, audit)

Always:
- Follow TypeScript best practices
- Write comprehensive tests
- Document your code
- Consider performance and security
- Use modern ES2022+ features

When helping users:
1. Understand their requirements thoroughly
2. Propose solutions with trade-offs
3. Implement incrementally with tests
4. Explain your reasoning clearly`;

  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'readFile',
        description: 'Read contents of a file',
        parameters: { path: { type: 'string' } },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'writeFile',
        description: 'Write contents to a file',
        parameters: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'searchCode',
        description: 'Search codebase for pattern',
        parameters: { pattern: { type: 'string' } },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'runTests',
        description: 'Run test suite',
        parameters: { path: { type: 'string' } },
      },
    },
  ];

  const tasks = [
    'How do I implement a custom React hook?',
    'Show me best practices for error handling',
    'Help me optimize this component for performance',
    'What testing strategy should I use?',
  ];

  console.log('Simulating 4 agent requests within 5 minutes...\n');

  let totalCost = 0;
  let totalNoCacheCost = 0;

  for (let i = 0; i < tasks.length; i++) {
    const messages = [
      cacheableSystemPrompt(systemPrompt),
      { role: 'user' as const, content: tasks[i] },
    ];

    const response = await client.chat(messages, {
      tools,
      enableCache: true,
    });

    if (response.usage) {
      const cost = calculateCacheCost({
        model: 'claude-3-5-sonnet-20241022',
        ...response.usage,
      });

      const noCacheCost =
        (response.usage.promptTokens / 1_000_000) * 3.0 +
        (response.usage.completionTokens / 1_000_000) * 15.0;

      totalCost += cost.total;
      totalNoCacheCost += noCacheCost;

      console.log(`Request ${i + 1}: ${tasks[i]}`);
      console.log(
        `  Tokens: ${response.usage.promptTokens} prompt, ${response.usage.completionTokens} completion`,
      );
      console.log(`  ${formatCacheStats(response.usage) || 'No cache activity'}`);
      console.log(`  Cost: $${cost.total.toFixed(6)} (saved $${cost.savings.toFixed(6)})`);
      console.log();
    }
  }

  console.log(`Total cost with caching: $${totalCost.toFixed(6)}`);
  console.log(`Total cost without caching: $${totalNoCacheCost.toFixed(6)}`);
  console.log(
    `Total savings: $${(totalNoCacheCost - totalCost).toFixed(6)} (${(((totalNoCacheCost - totalCost) / totalNoCacheCost) * 100).toFixed(1)}%)\n`,
  );
}

// Example 2: Document Q&A
async function _documentQAExample() {
  console.log('=== Example 2: Document Q&A ===\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const client = new LLMClient({
    provider: 'anthropic',
    apiKey,
    model: 'claude-3-5-sonnet-20241022',
  });

  // Simulate a large documentation file (5000 tokens)
  const documentation = `# TypeScript Documentation

## Advanced Types

TypeScript's type system is incredibly powerful...

[... extensive documentation content ...]

## Generics

Generics provide a way to make components work with any data type...

[... more documentation ...]

## Utility Types

TypeScript provides several utility types to facilitate common type transformations...

[... even more documentation ...]
`.repeat(50); // Simulate large doc

  const questions = [
    'What are generics?',
    'How do utility types work?',
    'Explain conditional types',
  ];

  let totalSavings = 0;

  for (let i = 0; i < questions.length; i++) {
    const conversation = createCachedConversation({
      systemPrompt: 'You are a TypeScript documentation assistant.',
      contextDocs: [documentation],
      messages: [{ role: 'user', content: questions[i] }],
    });

    const response = await client.chat(conversation, { enableCache: true });

    if (response.usage) {
      const cost = calculateCacheCost({
        model: 'claude-3-5-sonnet-20241022',
        ...response.usage,
      });

      totalSavings += cost.savings;

      console.log(`Question ${i + 1}: ${questions[i]}`);
      console.log(`  ${formatCacheStats(response.usage)}`);
      console.log(`  Saved: $${cost.savings.toFixed(6)}\n`);
    }
  }

  console.log(`Total savings from caching documentation: $${totalSavings.toFixed(6)}\n`);
}

// Example 3: Estimating Potential Savings
function estimateSavingsExample() {
  console.log('=== Example 3: Estimating Savings ===\n');

  const scenarios = [
    {
      name: 'Low traffic (10 req/day, 30% hit rate)',
      inputTokens: 5000,
      hitRate: 0.3,
      cachedPct: 0.7,
    },
    {
      name: 'Medium traffic (100 req/day, 60% hit rate)',
      inputTokens: 5000,
      hitRate: 0.6,
      cachedPct: 0.7,
    },
    {
      name: 'High traffic (1000 req/day, 80% hit rate)',
      inputTokens: 5000,
      hitRate: 0.8,
      cachedPct: 0.7,
    },
  ];

  scenarios.forEach((scenario) => {
    const savings = estimateCacheSavings(
      scenario.inputTokens,
      scenario.hitRate,
      scenario.cachedPct,
    );

    console.log(scenario.name);
    console.log(`  Input tokens: ${scenario.inputTokens.toLocaleString()}`);
    console.log(`  Cache hit rate: ${(scenario.hitRate * 100).toFixed(0)}%`);
    console.log(`  Cached content: ${(scenario.cachedPct * 100).toFixed(0)}%`);
    console.log(`  Estimated savings: ${savings.toFixed(1)}%\n`);
  });
}

// Example 4: Multi-Turn Conversation
async function _multiTurnConversationExample() {
  console.log('=== Example 4: Multi-Turn Conversation ===\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const client = new LLMClient({
    provider: 'anthropic',
    apiKey,
    model: 'claude-3-5-sonnet-20241022',
  });

  const messages = [
    cacheableSystemPrompt('You are a helpful AI assistant with expertise in programming.'),
  ];

  const conversation = [
    'What is TypeScript?',
    'How does it compare to JavaScript?',
    'Show me an example of generics',
  ];

  let totalCost = 0;

  for (const userMessage of conversation) {
    messages.push({ role: 'user', content: userMessage });

    const response = await client.chat(messages, { enableCache: true });

    // Add assistant response
    messages.push({ role: 'assistant', content: response.content });

    if (response.usage) {
      const cost = calculateCacheCost({
        model: 'claude-3-5-sonnet-20241022',
        ...response.usage,
      });

      totalCost += cost.total;

      console.log(`User: ${userMessage}`);
      console.log(`  ${formatCacheStats(response.usage)}`);
      console.log(`  Cost: $${cost.total.toFixed(6)}\n`);
    }
  }

  console.log(`Total conversation cost: $${totalCost.toFixed(6)}\n`);
}

// Run all examples
async function main() {
  console.log('Anthropic Prompt Caching Examples');
  console.log('='.repeat(50));
  console.log();

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    console.log('\nSet your API key:');
    console.log('  export ANTHROPIC_API_KEY=your-key-here');
    process.exit(1);
  }

  try {
    // Run estimation example (no API calls)
    estimateSavingsExample();

    // Uncomment to run live examples (requires API key and makes real API calls)
    // await agentWithToolsExample()
    // await documentQAExample()
    // await multiTurnConversationExample()

    console.log('✅ Examples completed!');
    console.log('\nTo run live examples with API calls, uncomment the function calls in main()');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
