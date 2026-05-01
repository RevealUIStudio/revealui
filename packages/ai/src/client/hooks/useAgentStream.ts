/**
 * useAgentStream  -  React hook for streaming agent responses via SSE
 *
 * Uses fetch + ReadableStream (NOT EventSource  -  it doesn't support POST).
 * Accumulates AgentStreamChunks into state and exposes:
 *   - text: accumulated output text
 *   - chunks: all received chunks in order
 *   - isStreaming: true while the stream is open
 *   - error: last error message, if any
 *   - sessionId: agent-run session id from the leading session_info chunk (A.2b)
 *   - pendingElicitations: outstanding form-mode elicitation requests by id (A.2b)
 *   - submitElicitation: POST a response to /api/agent-stream/elicit (A.2b)
 *   - abort(): cancels the stream
 */

'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Mirror of `AgentStreamChunk` in
 * `@revealui/ai/orchestration/streaming-runtime`. Duplicated here (rather
 * than imported) so client bundles don't pull in server-only orchestration
 * code through the type graph. Keep these in lockstep — when a new chunk
 * type lands in the runtime, mirror it here.
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

/**
 * Outstanding elicitation request awaiting a UI response. The hook keeps
 * one entry per `elicitationId`; entries are removed when
 * `submitElicitation()` lands successfully or when the stream ends.
 */
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
 * validator. We accept a wider input shape so callers can pass
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
  /** Set when the leading `session_info` chunk arrives. Null otherwise. */
  sessionId: string | null;
  /** Map of pending elicitations keyed by elicitationId. */
  pendingElicitations: PendingElicitation[];
}

export interface UseAgentStreamReturn extends UseAgentStreamState {
  start: (request: AgentStreamRequest, apiBase?: string) => Promise<void>;
  abort: () => void;
  reset: () => void;
  /**
   * POST an elicitation response to `/api/agent-stream/elicit` and remove
   * the entry from `pendingElicitations` on success. Throws if the network
   * call fails or the server returns a non-2xx status.
   */
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

        // Parse SSE lines: "data: {...}\n\n"
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
            // Malformed SSE data  -  skip
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
      // Remove the resolved entry from pendingElicitations
      setState((s) => ({
        ...s,
        pendingElicitations: s.pendingElicitations.filter((p) => p.elicitationId !== elicitationId),
      }));
    },
    [],
  );

  // submitElicitation needs the *current* sessionId at call time, so we
  // mirror state into a ref. Avoids stale-closure bugs without making the
  // callback's dependencies churn on every chunk.
  const stateRef = useRef(state);
  stateRef.current = state;

  return { ...state, start, abort, reset, submitElicitation };
}

/**
 * Pure reducer applying one SSE chunk to the hook's state. Extracted for
 * test-friendliness — call sites can simulate `start()` by feeding chunks
 * to `applyChunk()` against `INITIAL_STATE`.
 *
 * @internal
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
      // Cancel all pending elicitations on stream error — the server-side
      // session is being torn down so any open form is no longer
      // resolvable.
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
    // tool_call_start / tool_call_result / sampling_request: no state
    // mutation beyond appending to `chunks`. Consumers render from the
    // chunk list directly.
    default:
      break;
  }

  return next;
}

// ---------------------------------------------------------------------------
// Test-only export
// ---------------------------------------------------------------------------

/**
 * Pure reducer used internally to apply a chunk to state. Exported for
 * unit tests so the chunk → state mapping can be verified without
 * mounting a React component or stubbing `fetch`.
 *
 * @internal
 */
export const _applyChunkForTesting = applyChunk;
export const _initialStateForTesting: UseAgentStreamState = INITIAL_STATE;
