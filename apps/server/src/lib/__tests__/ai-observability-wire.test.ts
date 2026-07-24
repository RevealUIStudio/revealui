import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const AgentEventLogger = vi.fn(function AgentEventLogger(
  this: { maxEvents?: number },
  opts?: {
    maxEvents?: number;
  },
) {
  this.maxEvents = opts?.maxEvents;
  return this;
});

vi.mock('@revealui/ai/observability', () => ({
  AgentEventLogger,
}));

describe('ai-observability-wire', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('is disabled by default', async () => {
    const { isAiObservabilityWireEnabled, createAgentEventLoggerIfEnabled } = await import(
      '../ai-observability-wire.js'
    );
    expect(isAiObservabilityWireEnabled({})).toBe(false);
    expect(createAgentEventLoggerIfEnabled({})).toBeNull();
    expect(AgentEventLogger).not.toHaveBeenCalled();
  });

  it('creates logger when REVEALUI_AI_OBSERVABILITY=1', async () => {
    const { createAgentEventLoggerIfEnabled } = await import('../ai-observability-wire.js');
    const eventLogger = createAgentEventLoggerIfEnabled({ REVEALUI_AI_OBSERVABILITY: '1' });
    expect(eventLogger).not.toBeNull();
    expect(AgentEventLogger).toHaveBeenCalledWith({ maxEvents: 1000 });
  });
});
