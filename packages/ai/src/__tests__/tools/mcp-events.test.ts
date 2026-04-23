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
