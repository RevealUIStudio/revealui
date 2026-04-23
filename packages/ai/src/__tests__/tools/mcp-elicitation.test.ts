/**
 * Stage 5.3 — tests for `createElicitationHandler`.
 *
 * Covers URL-mode auto-decline, timeout behavior, error-to-cancel
 * mapping, observability, and the happy path through the consumer's
 * onElicit callback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createElicitationHandler,
  type McpElicitRequestParams,
  type McpElicitResult,
} from '../../tools/mcp-elicitation.js';

function makeParams(overrides: Partial<McpElicitRequestParams> = {}): McpElicitRequestParams {
  return {
    message: 'Please confirm the action.',
    requestedSchema: {
      type: 'object',
      properties: { confirm: { type: 'boolean' } },
      required: ['confirm'],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createElicitationHandler — happy path', () => {
  it('invokes onElicit and returns the user response verbatim', async () => {
    const onElicit = vi.fn(
      async (): Promise<McpElicitResult> => ({ action: 'accept', content: { confirm: true } }),
    );
    const handler = createElicitationHandler({ onElicit });
    const params = makeParams();

    const result = await handler(params);

    expect(onElicit).toHaveBeenCalledWith(params);
    expect(result).toEqual({ action: 'accept', content: { confirm: true } });
  });

  it('passes decline + cancel responses through verbatim', async () => {
    const handler = createElicitationHandler({
      onElicit: async (params) => {
        if (params.message.includes('cancel')) return { action: 'cancel' };
        return { action: 'decline' };
      },
    });

    expect((await handler(makeParams({ message: 'please cancel' }))).action).toBe('cancel');
    expect((await handler(makeParams({ message: 'please decline' }))).action).toBe('decline');
  });
});

describe('createElicitationHandler — URL mode', () => {
  it('auto-declines mode: "url" requests by default', async () => {
    const onElicit = vi.fn();
    const handler = createElicitationHandler({ onElicit });

    const result = await handler(makeParams({ mode: 'url' }));

    expect(result).toEqual({ action: 'decline' });
    expect(onElicit).not.toHaveBeenCalled();
  });

  it('allows url mode when allowUrlMode is true', async () => {
    const onElicit = vi.fn(
      async (): Promise<McpElicitResult> => ({ action: 'accept', content: { ok: true } }),
    );
    const handler = createElicitationHandler({ onElicit, allowUrlMode: true });

    const result = await handler(makeParams({ mode: 'url' }));

    expect(onElicit).toHaveBeenCalledTimes(1);
    expect(result.action).toBe('accept');
  });

  it('lets through form mode normally regardless of allowUrlMode', async () => {
    const onElicit = vi.fn(async (): Promise<McpElicitResult> => ({ action: 'accept' }));
    const handler = createElicitationHandler({ onElicit });

    await handler(makeParams({ mode: 'form' }));

    expect(onElicit).toHaveBeenCalledTimes(1);
  });
});

describe('createElicitationHandler — timeout', () => {
  it('cancels when the user does not respond within timeoutMs', async () => {
    vi.useFakeTimers();
    const handler = createElicitationHandler({
      onElicit: () => new Promise(() => undefined), // never resolves
      timeoutMs: 1_000,
    });

    const resultPromise = handler(makeParams());
    await vi.advanceTimersByTimeAsync(1_001);
    const result = await resultPromise;

    expect(result).toEqual({ action: 'cancel' });
  });

  it('returns the user response if it arrives before the timeout', async () => {
    vi.useFakeTimers();
    const handler = createElicitationHandler({
      onElicit: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { action: 'accept', content: { ok: true } };
      },
      timeoutMs: 1_000,
    });

    const resultPromise = handler(makeParams());
    await vi.advanceTimersByTimeAsync(100);
    const result = await resultPromise;

    expect(result).toEqual({ action: 'accept', content: { ok: true } });
  });

  it('disables timeout when timeoutMs is undefined or 0', async () => {
    const handler = createElicitationHandler({
      onElicit: async () => ({ action: 'accept' }),
      timeoutMs: 0,
    });
    const result = await handler(makeParams());
    expect(result.action).toBe('accept');
  });
});

describe('createElicitationHandler — error handling', () => {
  it('maps thrown errors from onElicit to { action: "cancel" }', async () => {
    const handler = createElicitationHandler({
      onElicit: async () => {
        throw new Error('UI unmounted');
      },
    });

    const result = await handler(makeParams());

    expect(result).toEqual({ action: 'cancel' });
  });
});

describe('createElicitationHandler — observability', () => {
  it('invokes onElicitationRequest with message + fieldCount before onElicit', async () => {
    const events: unknown[] = [];
    const handler = createElicitationHandler({
      onElicit: async () => ({ action: 'accept' }),
      onElicitationRequest: (info) => events.push(info),
    });

    await handler(
      makeParams({
        message: 'pick one',
        requestedSchema: {
          type: 'object',
          properties: { a: {}, b: {}, c: {} },
        },
      }),
    );

    expect(events).toEqual([{ message: 'pick one', fieldCount: 3 }]);
  });

  it('includes mode in the observability event when provided', async () => {
    const events: unknown[] = [];
    const handler = createElicitationHandler({
      onElicit: async () => ({ action: 'accept' }),
      allowUrlMode: true,
      onElicitationRequest: (info) => events.push(info),
    });

    await handler(makeParams({ mode: 'url' }));

    expect(events[0]).toMatchObject({ mode: 'url' });
  });
});

// ---------------------------------------------------------------------------
// Stage 6.1 — onEvent observability hook
// ---------------------------------------------------------------------------

describe('createElicitationHandler — onEvent', () => {
  it('emits mcp.elicitation.create with action: "accept" on user accept', async () => {
    const events: Array<Record<string, unknown>> = [];
    const handler = createElicitationHandler({
      onElicit: async () => ({ action: 'accept', content: { confirm: true } }),
      namespace: 'content',
      onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
    });

    await handler(makeParams());

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'mcp.elicitation.create',
      namespace: 'content',
      action: 'accept',
      fieldCount: 1,
      success: true,
    });
    expect(typeof events[0]?.duration_ms).toBe('number');
  });

  it('emits action: "decline" when the user declines', async () => {
    const events: Array<Record<string, unknown>> = [];
    const handler = createElicitationHandler({
      onElicit: async () => ({ action: 'decline' }),
      onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
    });
    await handler(makeParams());
    expect(events[0]).toMatchObject({ action: 'decline', success: true });
  });

  it('emits action: "cancel" when the user cancels', async () => {
    const events: Array<Record<string, unknown>> = [];
    const handler = createElicitationHandler({
      onElicit: async () => ({ action: 'cancel' }),
      onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
    });
    await handler(makeParams());
    expect(events[0]).toMatchObject({ action: 'cancel', success: true });
  });

  it('emits action: "decline" + success: true on URL-mode auto-decline', async () => {
    const events: Array<Record<string, unknown>> = [];
    const handler = createElicitationHandler({
      onElicit: async () => {
        throw new Error('should not be called');
      },
      onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
    });

    await handler(makeParams({ mode: 'url' }));

    expect(events[0]).toMatchObject({
      kind: 'mcp.elicitation.create',
      action: 'decline',
      mode: 'url',
      success: true,
    });
  });

  it('emits action: "cancel" when the timeout fires', async () => {
    vi.useFakeTimers();
    const events: Array<Record<string, unknown>> = [];
    const handler = createElicitationHandler({
      onElicit: () => new Promise(() => {}),
      timeoutMs: 100,
      onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
    });

    const promise = handler(makeParams());
    await vi.advanceTimersByTimeAsync(101);
    await promise;

    expect(events[0]).toMatchObject({ action: 'cancel', success: true });
  });

  it('emits action: "cancel" when onElicit throws (error is mapped to cancel)', async () => {
    const events: Array<Record<string, unknown>> = [];
    const handler = createElicitationHandler({
      onElicit: async () => {
        throw new Error('UI crashed');
      },
      onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
    });

    await handler(makeParams());

    // The action is 'cancel' because the error→cancel mapping wrapped the
    // thrown error before we emitted. success remains true — the handler
    // completed successfully, returning a valid spec result.
    expect(events[0]).toMatchObject({ action: 'cancel', success: true });
  });

  it('is silent without onEvent', async () => {
    const handler = createElicitationHandler({
      onElicit: async () => ({ action: 'accept' }),
    });
    const result = await handler(makeParams());
    expect(result.action).toBe('accept');
  });
});
