/**
 * Tests for the admin-local `useAgentStream` hook (A.2b-frontend).
 *
 * @vitest-environment jsdom
 *
 * Mirrors `@revealui/ai/client/hooks/useAgentStream.test.ts` — the two
 * hooks are intentionally identical in shape (boundary discipline puts
 * the admin copy here so apps don't statically import optional Pro
 * packages). Cover the new A.2b chunk types + submitElicitation flow.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _applyChunkForTesting,
  _initialStateForTesting,
  type AgentStreamChunk,
  useAgentStream,
} from '../useAgentStream.js';

const SESSION_ID = '00000000-0000-4000-8000-000000000000';

function makeSseStream(chunks: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    },
  });
}

function makeOkResponse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('admin useAgentStream  -  initial state', () => {
  it('starts empty + idle with null sessionId and no pending elicitations', () => {
    const { result } = renderHook(() => useAgentStream());
    expect(result.current.text).toBe('');
    expect(result.current.chunks).toHaveLength(0);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.sessionId).toBeNull();
    expect(result.current.pendingElicitations).toEqual([]);
  });
});

describe('admin useAgentStream  -  applyChunk reducer', () => {
  it('captures sessionId from session_info', () => {
    const next = _applyChunkForTesting(_initialStateForTesting, {
      type: 'session_info',
      sessionId: SESSION_ID,
    });
    expect(next.sessionId).toBe(SESSION_ID);
  });

  it('appends elicitation_request to pendingElicitations', () => {
    const start = { ..._initialStateForTesting, sessionId: SESSION_ID };
    const next = _applyChunkForTesting(start, {
      type: 'elicitation_request',
      sessionId: SESSION_ID,
      namespace: 'linear',
      elicitation: {
        elicitationId: 'elicit-1',
        requestedSchema: { type: 'object', properties: {} },
        message: 'Pick one',
      },
    });
    expect(next.pendingElicitations).toHaveLength(1);
    expect(next.pendingElicitations[0]).toEqual({
      elicitationId: 'elicit-1',
      namespace: 'linear',
      requestedSchema: { type: 'object', properties: {} },
      message: 'Pick one',
    });
  });

  it('clears pending elicitations on done', () => {
    const start: typeof _initialStateForTesting = {
      ..._initialStateForTesting,
      sessionId: SESSION_ID,
      isStreaming: true,
      pendingElicitations: [
        { elicitationId: 'elicit-1', namespace: 'linear', requestedSchema: {} },
      ],
    };
    const next = _applyChunkForTesting(start, { type: 'done' });
    expect(next.isStreaming).toBe(false);
    expect(next.pendingElicitations).toEqual([]);
  });

  it('clears pending elicitations on error', () => {
    const start: typeof _initialStateForTesting = {
      ..._initialStateForTesting,
      sessionId: SESSION_ID,
      isStreaming: true,
      pendingElicitations: [
        { elicitationId: 'elicit-1', namespace: 'linear', requestedSchema: {} },
      ],
    };
    const next = _applyChunkForTesting(start, { type: 'error', error: 'boom' });
    expect(next.error).toBe('boom');
    expect(next.pendingElicitations).toEqual([]);
  });

  it('drops malformed elicitation_request without elicitation payload', () => {
    const start = { ..._initialStateForTesting, sessionId: SESSION_ID };
    const malformed: AgentStreamChunk = {
      type: 'elicitation_request',
      sessionId: SESSION_ID,
      namespace: 'linear',
    };
    const next = _applyChunkForTesting(start, malformed);
    expect(next.pendingElicitations).toEqual([]);
  });
});

describe('admin useAgentStream  -  submitElicitation', () => {
  it('POSTs to /api/agent-stream/elicit with action+content and removes the entry', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeOkResponse(
          makeSseStream([
            { type: 'session_info', sessionId: SESSION_ID },
            {
              type: 'elicitation_request',
              sessionId: SESSION_ID,
              namespace: 'linear',
              elicitation: { elicitationId: 'elicit-1', requestedSchema: {} },
            },
          ]),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'go' });
    });

    await waitFor(() => expect(result.current.pendingElicitations).toHaveLength(1));

    await act(async () => {
      await result.current.submitElicitation('elicit-1', 'accept', { project: 'web' });
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const elicitCall = fetchSpy.mock.calls[1];
    expect(elicitCall).toBeDefined();
    if (!elicitCall) return; // narrow for TS
    const [url, init] = elicitCall;
    expect(url).toBe('/api/agent-stream/elicit');
    expect(JSON.parse(init?.body as string)).toEqual({
      sessionId: SESSION_ID,
      elicitationId: 'elicit-1',
      action: 'accept',
      content: { project: 'web' },
    });
    expect(result.current.pendingElicitations).toHaveLength(0);
  });

  it('throws when sessionId is missing', async () => {
    const { result } = renderHook(() => useAgentStream());
    await expect(result.current.submitElicitation('elicit-1', 'cancel')).rejects.toThrow(
      /no sessionId/,
    );
  });

  it('throws on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeOkResponse(makeSseStream([{ type: 'session_info', sessionId: SESSION_ID }])),
      )
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'go' });
    });
    await waitFor(() => expect(result.current.sessionId).toBe(SESSION_ID));

    await expect(result.current.submitElicitation('elicit-1', 'accept', { x: 1 })).rejects.toThrow(
      /403/,
    );
  });
});
