import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextAuditAnchorPollDelayMs, startAdaptivePollLoop } from '../audit-anchor-scheduler.js';

describe('audit-anchor adaptive polling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the maximum idle wait when no batch is waiting', () => {
    expect(nextAuditAnchorPollDelayMs(10 * 60_000)).toBe(10 * 60_000);
  });

  it('wakes at the waiting batch max-lag deadline when it is sooner than idle polling', () => {
    expect(nextAuditAnchorPollDelayMs(10 * 60_000, 173_241, 100_000)).toBe(73_241);
  });

  it('keeps the idle cap when a waiting batch deadline is farther away', () => {
    expect(nextAuditAnchorPollDelayMs(10 * 60_000, 15 * 60_000, 0)).toBe(10 * 60_000);
  });

  it('schedules a positive retry when the readiness deadline has elapsed', () => {
    expect(nextAuditAnchorPollDelayMs(10 * 60_000, 0, 1)).toBe(1);
  });

  it('runs serially and recalculates the next delay from each result', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const run = vi.fn<() => Promise<{ nextReadinessAtMs?: number }>>();
    run.mockResolvedValueOnce({ nextReadinessAtMs: 900 }).mockResolvedValueOnce({});
    const onResult = vi.fn();
    const stop = startAdaptivePollLoop({
      initialDelayMs: 100,
      maxIdlePollMs: 1_000,
      retryDelayMs: 50,
      run,
      onResult,
      onError: vi.fn(),
      shouldRetrySoon: () => false,
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(799);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(3);

    stop();
  });

  it('uses the retry cadence for a settled sweep failure instead of the idle delay', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const run = vi
      .fn<() => Promise<{ errors: string[]; nextReadinessAtMs?: number }>>()
      .mockResolvedValueOnce({
        errors: ['database: fetch failed'],
        nextReadinessAtMs: 20,
      })
      .mockResolvedValueOnce({ errors: [] });
    const stop = startAdaptivePollLoop({
      initialDelayMs: 10,
      maxIdlePollMs: 10_000,
      retryDelayMs: 1_000,
      run,
      onResult: vi.fn(),
      onError: vi.fn(),
      shouldRetrySoon: (result) => result.errors.length > 0,
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does not schedule another pass after stop, including when a pass is in flight', async () => {
    vi.useFakeTimers();
    let resolveRun: ((value: { nextReadinessAtMs?: number }) => void) | undefined;
    const run = vi.fn(
      () => new Promise<{ nextReadinessAtMs?: number }>((resolve) => (resolveRun = resolve)),
    );
    const stop = startAdaptivePollLoop({
      initialDelayMs: 10,
      maxIdlePollMs: 100,
      retryDelayMs: 20,
      run,
      onResult: vi.fn(),
      onError: vi.fn(),
      shouldRetrySoon: () => false,
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(run).toHaveBeenCalledTimes(1);
    stop();
    resolveRun?.({ nextReadinessAtMs: 10 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
