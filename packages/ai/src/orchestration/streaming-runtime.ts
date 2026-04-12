/**
 * Streaming Agent Runtime
 *
 * Extends AgentRuntime with SSE-compatible streaming via LLMClient.stream().
 * Each yielded AgentStreamChunk maps to one SSE event.
 *
 * AnythingLLM lesson: SSE is the correct approach for unidirectional LLM output.
 * EventSource is not used client-side because it doesn't support POST  -  use fetch + ReadableStream.
 */

import { z } from 'zod/v4';
import type { ModelTier } from '../inference/context-budget.js';
import { compressToolResult } from '../inference/tool-result-compressor.js';
import type { LLMClient } from '../llm/client.js';
import type { ToolResult } from '../tools/base.js';
import { ToolCallDeduplicator } from '../tools/deduplicator.js';
import type { Agent, Task } from './agent.js';
import { AgentRuntime, type RuntimeConfig } from './runtime.js';

export interface AgentStreamChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_result' | 'error' | 'done';
  content?: string;
  toolCall?: { name: string; arguments: string };
  toolResult?: ToolResult;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
  };
}

export class StreamingAgentRuntime extends AgentRuntime {
  constructor(config: RuntimeConfig = {}) {
    super(config);
  }

  /**
   * Stream a task execution, yielding typed events as they occur.
   * Accepts an AbortSignal  -  on abort, emits an error event and stops.
   */
  async *streamTask(
    agent: Agent,
    task: Task,
    llmClient: LLMClient,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentStreamChunk> {
    const startTime = Date.now();
    const toolResults: ToolResult[] = [];
    const deduplicator = new ToolCallDeduplicator();
    let iterations = 0;
    const maxIterations = this.config.maxIterations ?? 10;
    const timeout = this.config.timeout ?? 60_000;
    const tier: ModelTier | undefined = this.config.modelTier;

    /** Extract tool result content for the message history, compressing if tier is set */
    const extractContent = (toolName: string, result: ToolResult): string => {
      const raw = result.content ?? JSON.stringify(result.data ?? result);
      return tier ? compressToolResult(toolName, raw, tier) : raw;
    };

    const messages: Array<{
      role: string;
      content: string;
      toolCalls?: unknown[];
      toolCallId?: string;
      cacheControl?: { type: string };
    }> = [
      {
        role: 'system',
        content: agent.instructions,
        cacheControl: { type: 'ephemeral' },
      },
      {
        role: 'user',
        content: task.description,
      },
    ];

    try {
      while (iterations < maxIterations) {
        iterations++;

        if (signal?.aborted) {
          yield { type: 'error', error: 'interrupted' };
          return;
        }

        if (Date.now() - startTime > timeout) {
          yield { type: 'error', error: 'Task execution timeout' };
          return;
        }

        // Accumulate streamed text and all tool calls
        let accumulatedContent = '';
        let pendingToolCalls: Array<{ name: string; arguments: string; id?: string }> = [];

        try {
          for await (const chunk of llmClient.stream(
            messages as Parameters<typeof llmClient.stream>[0],
            {
              tools: agent.tools.map((tool) => ({
                type: 'function' as const,
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: z.toJSONSchema(tool.parameters) as Record<string, unknown>,
                },
              })),
            },
          )) {
            if (signal?.aborted) {
              yield { type: 'error', error: 'interrupted' };
              return;
            }

            // Stream text content
            if (chunk.content) {
              accumulatedContent += chunk.content;
              yield { type: 'text', content: chunk.content };
            }

            // Collect all tool calls when streaming is complete
            if (chunk.toolCalls && chunk.toolCalls.length > 0 && chunk.done) {
              pendingToolCalls = chunk.toolCalls.map((tc) => ({
                name: tc.function.name,
                arguments: tc.function.arguments,
                id: tc.id,
              }));
            }
          }
        } catch (streamError) {
          yield {
            type: 'error',
            error: streamError instanceof Error ? streamError.message : String(streamError),
          };
          return;
        }

        // If no tool calls, task is complete
        if (pendingToolCalls.length === 0) {
          yield {
            type: 'done',
            content: accumulatedContent,
            metadata: { executionTime: Date.now() - startTime },
          };
          return;
        }

        // Push the assistant message with all tool calls
        messages.push({
          role: 'assistant',
          content: accumulatedContent,
          toolCalls: pendingToolCalls,
        });

        // Execute all tool calls in this response
        for (const tc of pendingToolCalls) {
          yield { type: 'tool_call_start', toolCall: { name: tc.name, arguments: tc.arguments } };

          const tool = agent.tools.find((t) => t.name === tc.name);
          if (!tool) {
            const result: ToolResult = { success: false, error: `Tool "${tc.name}" not found` };
            toolResults.push(result);
            yield { type: 'tool_call_result', toolResult: result };
            messages.push({
              role: 'tool',
              content: extractContent(tc.name, result),
              toolCallId: tc.id,
            });
            continue;
          }

          let params: unknown;
          try {
            params = JSON.parse(tc.arguments || '{}');
          } catch {
            params = {};
          }

          // Deduplication check
          if (deduplicator.isDuplicate(tc.name, params)) {
            const cached = deduplicator.getResult(tc.name, params) as ToolResult;
            toolResults.push(cached);
            yield { type: 'tool_call_result', toolResult: cached };
            messages.push({
              role: 'tool',
              content: extractContent(tc.name, cached),
              toolCallId: tc.id,
            });
            continue;
          }

          try {
            const result = await tool.execute(params);
            deduplicator.record(tc.name, params, result);
            toolResults.push(result);
            yield { type: 'tool_call_result', toolResult: result };
            messages.push({
              role: 'tool',
              content: extractContent(tc.name, result),
              toolCallId: tc.id,
            });
          } catch (toolError) {
            const result: ToolResult = {
              success: false,
              error: toolError instanceof Error ? toolError.message : String(toolError),
            };
            toolResults.push(result);
            yield { type: 'tool_call_result', toolResult: result };
            messages.push({
              role: 'tool',
              content: extractContent(tc.name, result),
              toolCallId: tc.id,
            });
          }
        }
      }

      yield { type: 'error', error: 'Maximum iterations reached' };
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
        metadata: { executionTime: Date.now() - startTime },
      };
    }
  }
}
