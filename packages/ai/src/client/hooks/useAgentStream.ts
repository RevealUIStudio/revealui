/**
 * useAgentStream  -  React hook for streaming agent responses via SSE
 *
 * Uses fetch + ReadableStream (NOT EventSource  -  it doesn't support POST).
 * Accumulates AgentStreamChunks into state and exposes:
 *   - text: accumulated output text
 *   - chunks: all received chunks in order
 *   - isStreaming: true while the stream is open
 *   - error: last error message, if any
 *   - abort(): cancels the stream
 */

'use client';

import { useCallback, useRef, useState } from 'react';

export interface AgentStreamChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_result' | 'error' | 'done';
  content?: string;
  toolCall?: { name: string; arguments: string };
  toolResult?: unknown;
  error?: string;
  metadata?: { tokensUsed?: number; executionTime?: number };
}

export interface AgentStreamRequest {
  instruction: string;
  boardId?: string;
  workspaceId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface UseAgentStreamState {
  text: string;
  chunks: AgentStreamChunk[];
  isStreaming: boolean;
  error: string | null;
}

export interface UseAgentStreamReturn extends UseAgentStreamState {
  start: (request: AgentStreamRequest, apiBase?: string) => Promise<void>;
  abort: () => void;
  reset: () => void;
}

const INITIAL_STATE: UseAgentStreamState = {
  text: '',
  chunks: [],
  isStreaming: false,
  error: null,
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

    setState({ text: '', chunks: [], isStreaming: true, error: null });

    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
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
          try {
            const chunk = JSON.parse(jsonStr) as AgentStreamChunk;
            setState((s) => ({
              ...s,
              chunks: [...s.chunks, chunk],
              text: chunk.type === 'text' ? s.text + (chunk.content ?? '') : s.text,
              error: chunk.type === 'error' ? (chunk.error ?? 'Unknown error') : s.error,
              isStreaming: chunk.type !== 'done' && chunk.type !== 'error',
            }));
          } catch {
            // Malformed SSE data  -  skip
          }
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

  return { ...state, start, abort, reset };
}
