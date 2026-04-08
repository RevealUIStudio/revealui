/**
 * useAgentStream Hook Tests
 *
 * @vitest-environment jsdom
 *
 * Covers: start(), abort(), reset() across successful streaming, HTTP errors,
 * abort cancellation, done/error chunks, malformed SSE data, and no-body responses.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentStream } from '../useAgentStream.js';

// ─── SSE Stream Builder ───────────────────────────────────────────────────────

/**
 * Build a ReadableStream that emits the given chunks as SSE `data: {...}\n\n` events.
 * Optionally delay between chunks to simulate async streaming.
 */
function makeSseStream(chunks: object[], delayMs = 0): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    },
  });
}

function makeOkResponse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, { status: 200 });
}

function makeErrorResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAgentStream — initial state', () => {
  it('starts with empty text, no chunks, not streaming, no error', () => {
    const { result } = renderHook(() => useAgentStream());
    expect(result.current.text).toBe('');
    expect(result.current.chunks).toHaveLength(0);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe('useAgentStream — successful streaming', () => {
  it('accumulates text chunks and sets isStreaming=true while streaming', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeOkResponse(
        makeSseStream([
          { type: 'text', content: 'Hello' },
          { type: 'text', content: ' world' },
          { type: 'done', content: 'Hello world' },
        ]),
      ),
    );

    const { result } = renderHook(() => useAgentStream());

    act(() => {
      result.current.start({ instruction: 'Say hello' });
    });

    // isStreaming should flip true almost immediately
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    // After stream completes, isStreaming should be false
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    expect(result.current.text).toBe('Hello world');
    expect(result.current.chunks).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it('posts to the correct apiBase URL', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(makeOkResponse(makeSseStream([{ type: 'done' }])));

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'test' }, 'https://api.example.com/stream');
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/stream',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('serialises the request body as JSON with Content-Type header', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(makeOkResponse(makeSseStream([{ type: 'done' }])));

    const { result } = renderHook(() => useAgentStream());
    const req = { instruction: 'run task', boardId: 'board-1', priority: 'high' as const };
    await act(async () => {
      await result.current.start(req);
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toMatchObject(req);
  });

  it('stops accumulating text on done chunk', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeOkResponse(makeSseStream([{ type: 'text', content: 'partial' }, { type: 'done' }])),
    );

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'go' });
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.text).toBe('partial');
  });
});

describe('useAgentStream — error handling', () => {
  it('sets error state on HTTP error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeErrorResponse(500, 'Internal Server Error'),
    );

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'fail' });
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toMatch(/500/);
  });

  it('sets error state when no response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }) as Response,
    );

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'nobody' });
    });

    expect(result.current.error).toBe('No response body');
    expect(result.current.isStreaming).toBe(false);
  });

  it('captures error message from error chunk', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeOkResponse(makeSseStream([{ type: 'error', error: 'agent crashed' }])),
    );

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'crash' });
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.error).toBe('agent crashed');
  });

  it('sets error when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'broken' });
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('Network failure');
  });

  it('silently skips malformed SSE data lines', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Malformed + valid + no-data-prefix + valid done
        controller.enqueue(encoder.encode('data: {broken json}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"text","content":"ok"}\n\n'));
        controller.enqueue(encoder.encode('event: ping\n\n')); // no data: prefix
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse(body));

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'malformed test' });
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.error).toBeNull();
    // Only the valid text chunk and done are counted (not the malformed ones)
    expect(result.current.chunks.filter((c) => c.type === 'text')).toHaveLength(1);
    expect(result.current.text).toBe('ok');
  });
});

describe('useAgentStream — abort', () => {
  it('abort() cancels the fetch and sets isStreaming=false', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, _reject) => {
          // Rejection is driven by the abort signal listener — no manual reject needed
          init?.signal?.addEventListener('abort', () => {
            _reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    );

    const { result } = renderHook(() => useAgentStream());

    act(() => {
      result.current.start({ instruction: 'long task' });
    });

    act(() => {
      result.current.abort();
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.error).toBeNull(); // AbortError is swallowed
  });
});

describe('useAgentStream — reset', () => {
  it('reset() clears all state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeOkResponse(makeSseStream([{ type: 'text', content: 'data' }, { type: 'done' }])),
    );

    const { result } = renderHook(() => useAgentStream());
    await act(async () => {
      await result.current.start({ instruction: 'populate state' });
    });

    await waitFor(() => expect(result.current.text).toBe('data'));

    act(() => {
      result.current.reset();
    });

    expect(result.current.text).toBe('');
    expect(result.current.chunks).toHaveLength(0);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calling start() cancels any in-progress stream and resets state', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, _init) => {
      callCount++;
      if (callCount === 1) {
        // First call: never resolves (simulates in-flight request)
        return new Promise(() => {});
      }
      return Promise.resolve(makeOkResponse(makeSseStream([{ type: 'done' }])));
    });

    const { result } = renderHook(() => useAgentStream());

    act(() => {
      result.current.start({ instruction: 'first' });
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    await act(async () => {
      await result.current.start({ instruction: 'second' });
    });

    // State resets between calls — only the second call's result is visible
    expect(callCount).toBe(2);
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.error).toBeNull();
  });
});
