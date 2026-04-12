import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('frame loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function importFrameLoop() {
    const mod = await import('../core/frame-loop.js');
    return mod.onFrame;
  }

  it('schedules requestAnimationFrame when first callback registers', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
    const onFrame = await importFrameLoop();

    const cleanup = onFrame(() => {});
    expect(rafSpy).toHaveBeenCalled();
    cleanup();
    rafSpy.mockRestore();
  });

  it('calls callback with dt in seconds', async () => {
    const onFrame = await importFrameLoop();
    const cb = vi.fn();

    onFrame(cb);

    // Advance by ~16ms to trigger a frame
    vi.advanceTimersByTime(16);

    expect(cb).toHaveBeenCalled();
    const dt = cb.mock.calls[0][0] as number;
    expect(dt).toBeGreaterThan(0);
    expect(dt).toBeLessThanOrEqual(0.064);
  });

  it('caps dt at 64ms', async () => {
    const onFrame = await importFrameLoop();
    const cb = vi.fn();

    onFrame(cb);

    // Advance by 200ms  -  should cap dt at 64ms
    vi.advanceTimersByTime(200);

    expect(cb).toHaveBeenCalled();
    const dt = cb.mock.calls[0][0] as number;
    expect(dt).toBeLessThanOrEqual(0.064);
  });

  it('continues scheduling frames while callbacks exist', async () => {
    const onFrame = await importFrameLoop();
    const cb = vi.fn();

    onFrame(cb);

    vi.advanceTimersByTime(16);
    vi.advanceTimersByTime(16);

    expect(cb.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('supports multiple concurrent callbacks', async () => {
    const onFrame = await importFrameLoop();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    onFrame(cb1);
    onFrame(cb2);

    vi.advanceTimersByTime(16);

    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('cleanup removes only the specified callback', async () => {
    const onFrame = await importFrameLoop();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const cleanup1 = onFrame(cb1);
    onFrame(cb2);

    cleanup1();

    vi.advanceTimersByTime(16);

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('stops loop when all callbacks removed', async () => {
    const onFrame = await importFrameLoop();
    const cb = vi.fn();

    const cleanup = onFrame(cb);
    cleanup();

    vi.advanceTimersByTime(16);
    // After the tick sees empty set, cb should not be called again
    vi.advanceTimersByTime(16);

    // cb should have been called 0 or 1 times (the pending tick may fire once)
    expect(cb.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
