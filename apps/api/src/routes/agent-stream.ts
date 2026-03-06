/**
 * Agent Stream Route
 *
 * POST /api/agent-stream → text/event-stream (SSE)
 *
 * Streams agent execution events in real-time using Hono's streamSSE helper.
 * Each AgentStreamChunk becomes one "data: {...}\n\n" SSE event.
 *
 * Client-side: use fetch + ReadableStream (not EventSource — it doesn't support POST).
 * See packages/ai/src/client/hooks/useAgentStream.ts for the React hook.
 */

import { createLLMClientFromEnv } from '@revealui/ai'
import { LLMClient } from '@revealui/ai/llm/client'
import type { Agent, Task } from '@revealui/ai/orchestration/agent'
import { StreamingAgentRuntime } from '@revealui/ai/orchestration/streaming-runtime'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

type Variables = {
  tenant?: { id: string }
}

// biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables` in its generic type parameter
const app = new Hono<{ Variables: Variables }>()

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    instruction?: string
    boardId?: string
    workspaceId?: string
    priority?: string
  } | null

  if (!body?.instruction) {
    return c.json({ success: false, error: 'instruction is required' }, 400)
  }

  // BYOK: accept API key via Authorization header (never in request body)
  const authHeader = c.req.header('Authorization')
  const byokKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  let llmClient: LLMClient
  try {
    if (byokKey) {
      llmClient = new LLMClient({
        provider: 'groq',
        apiKey: byokKey,
        model: 'llama-3.3-70b-versatile',
      })
    } else {
      llmClient = createLLMClientFromEnv()
    }
  } catch {
    return c.json({ success: false, error: 'AI provider not configured' }, 503)
  }

  const workspaceId = body.workspaceId ?? c.get('tenant')?.id ?? 'default'

  const agent: Agent = {
    id: 'stream-agent',
    name: 'Stream Agent',
    instructions: `You are a helpful AI assistant for RevealUI workspace ${workspaceId}. Complete the user's request accurately and concisely.`,
    tools: [],
    memory: undefined,
    getContext: () => ({ agentId: 'stream-agent' }),
  }

  const task: Task = {
    id: `task-${Date.now()}`,
    type: 'instruction',
    description: body.instruction,
  }

  const runtime = new StreamingAgentRuntime({ maxIterations: 10, timeout: 120_000 })

  return streamSSE(c, async (stream) => {
    const controller = new AbortController()

    // Clean up on client disconnect
    c.req.raw.signal?.addEventListener('abort', () => controller.abort())

    try {
      for await (const chunk of runtime.streamTask(agent, task, llmClient, controller.signal)) {
        await stream.writeSSE({
          data: JSON.stringify(chunk),
          event: chunk.type,
        })

        if (chunk.type === 'done' || chunk.type === 'error') break
      }
    } catch (error) {
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        event: 'error',
      })
    }
  })
})

export default app
