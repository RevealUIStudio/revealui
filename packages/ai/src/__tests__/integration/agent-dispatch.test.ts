/**
 * Agent E2E Dispatch Integration Test
 *
 * Verifies the full agent orchestration chain works against a real LLM.
 * Uses Ollama (localhost:11434) when available, falls back to GROQ.
 * OpenAI is intentionally NOT used  -  no OpenAI spend until the business has
 * paying customers.
 *
 * Run:
 *   pnpm --filter @revealui/ai test:integration
 *
 * Prerequisites:
 *   - Ollama running: `ollama serve` + `ollama pull gemma4:e2b`
 *   - OR set GROQ_API_KEY in env
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { LLMClient } from '../../llm/client.js';
import type { EpisodicMemory } from '../../memory/stores/episodic-memory.js';
import type { Agent, AgentResult, Task } from '../../orchestration/agent.js';
import { AgentRuntime } from '../../orchestration/runtime.js';

/** Try to detect Ollama at the default local port. */
async function isOllamaAvailable(baseURL = 'http://localhost:11434'): Promise<boolean> {
  try {
    const res = await fetch(`${baseURL}/v1/models`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Build a real LLM client, preferring local Ollama then env-configured providers. */
async function buildLLMClient(): Promise<LLMClient | null> {
  // 1. Try Ollama (free, local, no quota issues)
  const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  if (await isOllamaAvailable(ollamaBase)) {
    return new LLMClient({
      provider: 'ollama',
      apiKey: 'ollama',
      baseURL: `${ollamaBase}/v1`,
      model: process.env.LLM_MODEL ?? 'gemma4:e2b',
    });
  }

  // 2. Fall back to Groq (free tier, cloud)
  if (process.env.GROQ_API_KEY) {
    return new LLMClient({
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.LLM_MODEL ?? 'qwen/qwen3-32b',
    });
  }

  // No OpenAI  -  not authorized until business has paying customers.
  // No Anthropic  -  reserved for Claude Code sessions, not runtime cost.
  return null;
}

describe('Agent E2E Dispatch', async () => {
  const llmClient = await buildLLMClient();

  describe.skipIf(!llmClient)('with live LLM', () => {
    it('runs the agentic loop and returns a text result (no tools)', async () => {
      const runtime = new AgentRuntime({ maxIterations: 3, timeout: 120_000 });

      const agent: Agent = {
        id: 'test-agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant. Answer questions concisely in one sentence.',
        tools: [],
        memory: {} as EpisodicMemory,
        execute(_task: Task): Promise<AgentResult> {
          return Promise.resolve({ success: false, error: 'Direct execute not supported' });
        },
        getContext() {
          return {
            agentId: 'test-agent-1',
            currentTask: { id: 'task-1', type: 'test', description: '' },
          };
        },
      };

      const task: Task = {
        id: 'task-e2e-1',
        type: 'test',
        description: 'What is 2 + 2? Answer with just the number.',
        priority: 1,
      };

      const result = await runtime.executeTask(agent, task, llmClient!);

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
      expect(result.output).toMatch(/4/);
      expect(result.metadata?.executionTime).toBeGreaterThan(0);
    }, 120_000);

    it('runs the agentic loop with a stub tool and records tool results', async () => {
      const runtime = new AgentRuntime({ maxIterations: 5, timeout: 120_000 });
      const toolCalled: string[] = [];

      const agent: Agent = {
        id: 'test-agent-2',
        name: 'Tool Test Agent',
        instructions:
          'You must always call the get_greeting tool to fetch a greeting, then respond with the greeting text you received.',
        tools: [
          {
            name: 'get_greeting',
            description: 'Returns a greeting message',
            parameters: z.object({
              name: z.string().describe('Name to greet'),
            }),
            async execute(params: unknown) {
              const { name } = params as { name: string };
              toolCalled.push(name);
              return { success: true, data: `Hello, ${name}!` };
            },
          },
        ],
        memory: {} as EpisodicMemory,
        execute(_task: Task): Promise<AgentResult> {
          return Promise.resolve({ success: false, error: 'Direct execute not supported' });
        },
        getContext() {
          return {
            agentId: 'test-agent-2',
            currentTask: { id: 'task-2', type: 'test', description: '' },
          };
        },
      };

      const task: Task = {
        id: 'task-e2e-2',
        type: 'test',
        description: 'Call the get_greeting tool with name="World" and tell me what it returned.',
        priority: 1,
      };

      const result = await runtime.executeTask(agent, task, llmClient!);

      expect(result.success).toBe(true);
      expect(toolCalled).toContain('World');
      expect(result.toolResults?.length).toBeGreaterThan(0);
      expect(result.toolResults?.[0]?.success).toBe(true);
    }, 120_000);
  });
});
