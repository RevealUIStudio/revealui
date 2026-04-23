/**
 * Stage 6.1 — tests for `mcp-events` (protocol log channel primitives).
 *
 * The event types themselves are pure structural shapes and don't need
 * dedicated tests. This file covers the two runtime helpers:
 *   - `createCoreLoggerSink()` — routes events to
 *     `@revealui/core/observability/logger` at the right level.
 *   - `emitMcpEvent()` — internal safe-dispatch helper used by the
 *     adapter / sampling / elicitation modules.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoreLoggerSink, emitMcpEvent, type McpLogEvent } from '../../tools/mcp-events.js';

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger,
  createLogger: vi.fn(() => logger),
}));

beforeEach(() => {
  logger.debug.mockClear();
  logger.info.mockClear();
  logger.warn.mockClear();
  logger.error.mockClear();
});

function successEvent(): McpLogEvent {
  return {
    kind: 'mcp.tool.call',
    namespace: 'content',
    toolName: 'list_items',
    duration_ms: 42,
    success: true,
  };
}

function failureEvent(): McpLogEvent {
  return {
    kind: 'mcp.tool.call',
    namespace: 'content',
    toolName: 'list_items',
    duration_ms: 7,
    success: false,
    error: 'boom',
  };
}

describe('createCoreLoggerSink', () => {
  it('routes successful events to logger.info by default', () => {
    const sink = createCoreLoggerSink();
    sink(successEvent());

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();

    const [message, payload] = logger.info.mock.calls[0] ?? [];
    expect(message).toBe('[mcp] mcp.tool.call');
    expect(payload).toMatchObject({
      event: 'mcp.tool.call',
      namespace: 'content',
      toolName: 'list_items',
      duration_ms: 42,
      success: true,
    });
    // `kind` is hoisted to the payload's `event` field (so ingestion can
    // filter on a single scalar), not duplicated on the payload itself.
    expect(payload).not.toHaveProperty('kind');
  });

  it('routes failed events to logger.warn regardless of successLevel', () => {
    const sink = createCoreLoggerSink({ successLevel: 'debug' });
    sink(failureEvent());

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();

    const [message, payload] = logger.warn.mock.calls[0] ?? [];
    expect(message).toBe('[mcp] mcp.tool.call');
    expect(payload).toMatchObject({
      event: 'mcp.tool.call',
      success: false,
      error: 'boom',
    });
  });

  it('drops successful events to logger.debug when successLevel: "debug"', () => {
    const sink = createCoreLoggerSink({ successLevel: 'debug' });
    sink(successEvent());

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('preserves event-specific fields for each kind', () => {
    const sink = createCoreLoggerSink();
    sink({
      kind: 'mcp.resource.read',
      namespace: 'content',
      uri: 'revealui://posts/123',
      duration_ms: 11,
      success: true,
    });
    sink({
      kind: 'mcp.sampling.create',
      model: 'gemma3',
      messageCount: 3,
      maxTokens: 512,
      duration_ms: 2001,
      success: true,
    });
    sink({
      kind: 'mcp.elicitation.create',
      action: 'accept',
      fieldCount: 2,
      duration_ms: 9,
      success: true,
    });

    expect(logger.info).toHaveBeenCalledTimes(3);
    const payloads = logger.info.mock.calls.map((call) => call[1]);
    expect(payloads[0]).toMatchObject({ event: 'mcp.resource.read', uri: 'revealui://posts/123' });
    expect(payloads[1]).toMatchObject({
      event: 'mcp.sampling.create',
      model: 'gemma3',
      messageCount: 3,
      maxTokens: 512,
    });
    expect(payloads[2]).toMatchObject({
      event: 'mcp.elicitation.create',
      action: 'accept',
      fieldCount: 2,
    });
  });
});

describe('emitMcpEvent', () => {
  it('is a no-op when sink is undefined', () => {
    expect(() => emitMcpEvent(undefined, successEvent())).not.toThrow();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('invokes the sink with the event verbatim', () => {
    const sink = vi.fn();
    const event = successEvent();
    emitMcpEvent(sink, event);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(event);
  });

  it('swallows sink exceptions and logs a warning', () => {
    const sink = vi.fn(() => {
      throw new Error('sink is broken');
    });
    expect(() => emitMcpEvent(sink, successEvent())).not.toThrow();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [message, payload] = logger.warn.mock.calls[0] ?? [];
    expect(message).toMatch(/event sink threw/);
    expect(payload).toMatchObject({
      event: 'mcp.tool.call',
      error: 'sink is broken',
    });
  });

  it('handles non-Error throws from the sink', () => {
    const sink = vi.fn(() => {
      throw 'string error';
    });
    expect(() => emitMcpEvent(sink, successEvent())).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        error: 'string error',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Stage 6.2 — createUsageMeterSink
// ---------------------------------------------------------------------------

import { createUsageMeterSink, type McpUsageMeterRow } from '../../tools/mcp-events.js';

describe('createUsageMeterSink', () => {
  it('writes a usage_meters row with accountId + meterName + defaults', () => {
    const rows: McpUsageMeterRow[] = [];
    const sink = createUsageMeterSink({
      accountId: 'acct-123',
      write: (row) => {
        rows.push(row);
      },
    });

    sink(successEvent());

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row).toMatchObject({
      accountId: 'acct-123',
      meterName: 'mcp.tool.call',
      quantity: 1,
      periodEnd: null,
      source: 'agent',
    });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(row.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(row.periodStart).toBeInstanceOf(Date);
  });

  it('maps each event kind to the matching meter name', () => {
    const rows: McpUsageMeterRow[] = [];
    const sink = createUsageMeterSink({
      accountId: 'acct-123',
      write: (row) => {
        rows.push(row);
      },
    });

    sink({
      kind: 'mcp.resource.read',
      namespace: 'content',
      uri: 'revealui://posts/1',
      duration_ms: 3,
      success: true,
    });
    sink({
      kind: 'mcp.prompt.get',
      namespace: 'content',
      promptName: 'greet',
      duration_ms: 4,
      success: true,
    });
    sink({
      kind: 'mcp.sampling.create',
      model: 'gemma3',
      messageCount: 2,
      maxTokens: 256,
      duration_ms: 1200,
      success: true,
    });
    sink({
      kind: 'mcp.elicitation.create',
      action: 'accept',
      fieldCount: 1,
      duration_ms: 8,
      success: true,
    });

    expect(rows.map((r) => r.meterName)).toEqual([
      'mcp.resource.read',
      'mcp.prompt.get',
      'mcp.sampling.create',
      'mcp.elicitation.create',
    ]);
  });

  it('honors custom source label', () => {
    const rows: McpUsageMeterRow[] = [];
    const sink = createUsageMeterSink({
      accountId: 'acct-123',
      source: 'api',
      write: (row) => {
        rows.push(row);
      },
    });
    sink(successEvent());
    expect(rows[0]?.source).toBe('api');
  });

  it('uses supplied idempotencyKey generator for retry coalescence', () => {
    const rows: McpUsageMeterRow[] = [];
    const sink = createUsageMeterSink({
      accountId: 'acct-123',
      idempotencyKey: (e) => `fixed:${e.kind}`,
      write: (row) => {
        rows.push(row);
      },
    });
    sink(successEvent());
    sink(successEvent());
    expect(rows[0]?.idempotencyKey).toBe('fixed:mcp.tool.call');
    expect(rows[1]?.idempotencyKey).toBe('fixed:mcp.tool.call');
  });

  it('uses supplied id generator', () => {
    const rows: McpUsageMeterRow[] = [];
    let counter = 0;
    const sink = createUsageMeterSink({
      accountId: 'acct-123',
      id: () => `row-${++counter}`,
      write: (row) => {
        rows.push(row);
      },
    });
    sink(successEvent());
    sink(successEvent());
    expect(rows[0]?.id).toBe('row-1');
    expect(rows[1]?.id).toBe('row-2');
  });

  it('emits a row for failed events too (billing cares about attempts)', () => {
    const rows: McpUsageMeterRow[] = [];
    const sink = createUsageMeterSink({
      accountId: 'acct-123',
      write: (row) => {
        rows.push(row);
      },
    });
    sink(failureEvent());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.meterName).toBe('mcp.tool.call');
  });

  it('awaits and swallows rejected async writes without throwing', async () => {
    const sink = createUsageMeterSink({
      accountId: 'acct-123',
      write: async () => {
        throw new Error('db unavailable');
      },
    });

    expect(() => sink(successEvent())).not.toThrow();
    // Let the rejected microtask settle so logger.warn is observed.
    await new Promise((r) => setTimeout(r, 0));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/usage meter write rejected/),
      expect.objectContaining({ event: 'mcp.tool.call', error: 'db unavailable' }),
    );
  });

  it('swallows synchronous write throws via emitMcpEvent when wrapped', () => {
    // When paired with the adapter's own emitMcpEvent safe-dispatch,
    // a sink that throws sync never propagates. Here we verify the
    // integration boundary: emitMcpEvent(sink, event) swallows
    // throws, and the usage-meter sink constructed here is callable
    // through that path.
    const brokenSink = createUsageMeterSink({
      accountId: 'acct-123',
      write: () => {
        throw new Error('sync write boom');
      },
    });

    expect(() => emitMcpEvent(brokenSink, successEvent())).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/event sink threw/),
      expect.objectContaining({ event: 'mcp.tool.call' }),
    );
  });
});
