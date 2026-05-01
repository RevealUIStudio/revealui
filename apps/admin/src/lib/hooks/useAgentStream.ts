/**
 * useAgentStream  -  React hook for streaming agent responses via SSE.
 *
 * Admin-local implementation. The Pro `@revealui/ai` package ships an
 * equivalent hook for non-admin consumers (CLI, harnesses, third-party
 * agent UIs); admin keeps its own copy so the structural-decoupling
 * discipline (`scripts/validate/boundary.ts` Check 4) holds — apps must
 * not statically import from optional Fair Source packages. The hook
 * shape is intentionally identical to `@revealui/ai/client/hooks/
 * useAgentStream`; when a chunk type lands in either, mirror it here.
 *
 * Uses fetch + ReadableStream (NOT EventSource — it doesn't support POST).
 * Accumulates AgentStreamChunks into state and exposes:
 *   - text: accumulated output text
 *   - chunks: all received chunks in order
 *   - isStreaming: true while the stream is open
 *   - error: last error message, if any
 *   - sessionId: agent-run session id from the leading session_info chunk
 *   - pendingElicitations: outstanding form-mode elicitation requests
 *   - submitElicitation: POST a response to /api/agent-stream/elicit
 *   - abort(): cancels the stream
 */

'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Mirror of `AgentStreamChunk` in
 * `@revealui/ai/orchestration/streaming-runtime`. Side-channel chunk
 * types (`session_info`, `sampling_request`, `elicitation_request`)
 * are emitted by the agent-stream route between turns; the runtime's
 * core `text | tool_call_start | tool_call_result | error | done`
 * still come from the generator.
 */
export interface AgentStreamChunk {
  type:
    | 'text'
    | 'tool_call_start'
    | 'tool_call_result'
    | 'error'
    | 'done'
    | 'session_info'
    | 'sampling_request'
    | 'elicitation_request';
  content?: string;
  toolCall?: { name: string; arguments: string };
  toolResult?: unknown;
  error?: string;
  metadata?: { tokensUsed?: number; executionTime?: number };
  /** Present on session_info / sampling_request / elicitation_request. */
  sessionId?: string;
  /** MCP server id. Present on sampling_request / elicitation_request. */
  namespace?: string;
  /** Present on sampling_request — the request shape sent to the LLM. */
  sampling?: {
    model: string;
    messageCount: number;
    maxTokens: number;
  };
  /** Present on elicitation_request — the form payload for the UI. */
  elicitation?: {
    elicitationId: string;
    requestedSchema: unknown;
    message?: string;
  };
}

export interface AgentStreamRequest {
  instruction: string;
  boardId?: string;
  workspaceId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /**
   * Agent mode. `'admin'` (default) gives the agent the admin-tools surface;
   * `'coding'` adds file-read/write/grep + shell + git tools (Pro-tier;
   * free-tier sees read-only subset). Mirrors `mode?` in the `/api/agent-stream`
   * request schema.
   */
  mode?: 'admin' | 'coding';
}

export interface PendingElicitation {
  elicitationId: string;
  namespace: string;
  requestedSchema: unknown;
  message?: string;
}

export type ElicitationAction = 'accept' | 'decline' | 'cancel';

/**
 * Permitted primitive value types per the MCP spec (`ElicitResult.content`).
 * The hook is a thin transport — the server-side zod schema at
 * `apps/server/src/routes/agent-stream-elicit.ts` is the authoritative
 * validator. We accept a wider input shape here so callers can pass
 * `Record<string, unknown>` from generic form serializers without
 * up-front narrowing; non-primitive values get rejected by the server.
 */
export type ElicitationContentValue = string | number | boolean | string[];
export type ElicitationContent = Record<string, unknown>;

export interface UseAgentStreamState {
  text: string;
  chunks: AgentStreamChunk[];
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
  pendingElicitations: PendingElicitation[];
}

export interface UseAgentStreamReturn extends UseAgentStreamState {
  start: (request: AgentStreamRequest, apiBase?: string) => Promise<void>;
  abort: () => void;
  reset: () => void;
  submitElicitation: (
    elicitationId: string,
    action: ElicitationAction,
    content?: ElicitationContent,
  ) => Promise<void>;
}

const INITIAL_STATE: UseAgentStreamState = {
  text: '',
  chunks: [],
  isStreaming: false,
  error: null,
  sessionId: null,
  pendingElicitations: [],
};

export function useAgentStream(): UseAgentStreamReturn {
  const [state, setState] = useState<UseAgentStreamState>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  const start = useCallback(async (request: AgentStreamRequest, apiBase = '/api/agent-stream') => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState({ ...INITIAL_STATE, isStreaming: true });

    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        setState((s) => ({
          ...s,
          isStreaming: false,
          error: `HTTP ${response.status}: ${errText}`,
        }));
        return;
      }

      if (!response.body) {
        setState((s) => ({ ...s, isStreaming: false, error: 'No response body' }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;

          const jsonStr = dataLine.slice(6);
          let chunk: AgentStreamChunk;
          try {
            chunk = JSON.parse(jsonStr) as AgentStreamChunk;
          } catch {
            continue;
          }
          setState((s) => applyChunk(s, chunk));
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setState((s) => ({ ...s, isStreaming: false }));
        return;
      }
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const submitElicitation = useCallback(
    async (
      elicitationId: string,
      action: ElicitationAction,
      content?: ElicitationContent,
    ): Promise<void> => {
      const sessionId = stateRef.current.sessionId;
      if (!sessionId) {
        throw new Error(
          'useAgentStream: no sessionId — start() must run before submitElicitation()',
        );
      }
      const body: Record<string, unknown> = { sessionId, elicitationId, action };
      if (action === 'accept' && content) body.content = content;

      const response = await fetch('/api/agent-stream/elicit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`elicit response failed: HTTP ${response.status}: ${errText}`);
      }
      setState((s) => ({
        ...s,
        pendingElicitations: s.pendingElicitations.filter((p) => p.elicitationId !== elicitationId),
      }));
    },
    [],
  );

  return { ...state, start, abort, reset, submitElicitation };
}

/**
 * Pure reducer applying one SSE chunk to the hook's state. Extracted for
 * test-friendliness — call sites can simulate `start()` by feeding chunks
 * to `applyChunk()` against `INITIAL_STATE`.
 */
function applyChunk(s: UseAgentStreamState, chunk: AgentStreamChunk): UseAgentStreamState {
  const next: UseAgentStreamState = {
    ...s,
    chunks: [...s.chunks, chunk],
  };

  switch (chunk.type) {
    case 'session_info':
      if (chunk.sessionId) next.sessionId = chunk.sessionId;
      break;
    case 'text':
      next.text = s.text + (chunk.content ?? '');
      break;
    case 'error':
      next.error = chunk.error ?? 'Unknown error';
      next.isStreaming = false;
      next.pendingElicitations = [];
      break;
    case 'done':
      next.isStreaming = false;
      next.pendingElicitations = [];
      break;
    case 'elicitation_request':
      if (chunk.elicitation && chunk.namespace) {
        next.pendingElicitations = [
          ...s.pendingElicitations,
          {
            elicitationId: chunk.elicitation.elicitationId,
            namespace: chunk.namespace,
            requestedSchema: chunk.elicitation.requestedSchema,
            ...(chunk.elicitation.message ? { message: chunk.elicitation.message } : {}),
          },
        ];
      }
      break;
    default:
      break;
  }

  return next;
}

// Test-only exports
export const _applyChunkForTesting = applyChunk;
export const _initialStateForTesting: UseAgentStreamState = INITIAL_STATE;
