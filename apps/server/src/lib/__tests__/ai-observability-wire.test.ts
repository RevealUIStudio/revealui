import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const load = vi.fn().mockResolvedValue(undefined);
const AgentEventLogger = vi.fn(function AgentEventLogger(
  this: { maxEvents?: number; load: typeof load },
  opts?: { maxEvents?: number; storage?: unknown; autoFlush?: boolean },
) {
  this.maxEvents = opts?.maxEvents;
  this.load = load;
  return this;
});
const FileSystemEventStorage = vi.fn(function FileSystemEventStorage(
  this: { path: string },
  path: string,
) {
  this.path = path;
  return this;
});

vi.mock('@revealui/ai/observability', () => ({
  AgentEventLogger,
  FileSystemEventStorage,
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
    await expect(createAgentEventLoggerIfEnabled({})).resolves.toBeNull();
    expect(AgentEventLogger).not.toHaveBeenCalled();
  });

  it('creates in-memory logger when REVEALUI_AI_OBSERVABILITY=1 without path', async () => {
    const { createAgentEventLoggerIfEnabled } = await import('../ai-observability-wire.js');
    const eventLogger = await createAgentEventLoggerIfEnabled({ REVEALUI_AI_OBSERVABILITY: '1' });
    expect(eventLogger).not.toBeNull();
    expect(AgentEventLogger).toHaveBeenCalledWith({ maxEvents: 1000 });
    expect(FileSystemEventStorage).not.toHaveBeenCalled();
  });

  it('uses FileSystemEventStorage when REVEALUI_AI_OBSERVABILITY_PATH is set', async () => {
    const { createAgentEventLoggerIfEnabled, parseObservabilityFlushMs } = await import(
      '../ai-observability-wire.js'
    );
    expect(parseObservabilityFlushMs({})).toBe(5000);
    expect(parseObservabilityFlushMs({ REVEALUI_AI_OBSERVABILITY_FLUSH_MS: '2500' })).toBe(2500);

    const eventLogger = await createAgentEventLoggerIfEnabled({
      REVEALUI_AI_OBSERVABILITY: '1',
      REVEALUI_AI_OBSERVABILITY_PATH: '/tmp/agent-events.json',
      REVEALUI_AI_OBSERVABILITY_FLUSH_MS: '3000',
    });
    expect(eventLogger).not.toBeNull();
    expect(FileSystemEventStorage).toHaveBeenCalledWith('/tmp/agent-events.json');
    expect(AgentEventLogger).toHaveBeenCalledWith({
      maxEvents: 1000,
      storage: expect.any(Object),
      autoFlush: true,
      flushIntervalMs: 3000,
    });
    expect(load).toHaveBeenCalledOnce();
  });
});
