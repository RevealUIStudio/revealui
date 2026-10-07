/**
 * Adaptive timer for audit-anchor sweeps. The configured poll interval is the
 * maximum idle wait; a waiting batch can pull the next pass forward to its
 * max-lag deadline. A single timeout is used so a slow database pass can never
 * overlap the next one.
 */

export interface AuditAnchorReadiness {
  /** Epoch milliseconds when the earliest waiting batch reaches max-lag age. */
  nextReadinessAtMs?: number;
}

export function nextAuditAnchorPollDelayMs(
  maxIdlePollMs: number,
  nextReadinessAtMs?: number,
  nowMs = Date.now(),
): number {
  if (!Number.isFinite(maxIdlePollMs) || maxIdlePollMs <= 0) {
    throw new RangeError('maxIdlePollMs must be a positive finite number');
  }
  if (nextReadinessAtMs === undefined || !Number.isFinite(nextReadinessAtMs)) {
    return maxIdlePollMs;
  }
  return Math.max(1, Math.min(maxIdlePollMs, Math.ceil(nextReadinessAtMs - nowMs)));
}

export interface AdaptivePollLoopOptions<T extends AuditAnchorReadiness> {
  initialDelayMs: number;
  maxIdlePollMs: number;
  retryDelayMs: number;
  run: () => Promise<T>;
  onResult: (result: T) => void;
  onError: (error: unknown) => void;
  shouldRetrySoon: (result: T) => boolean;
}

/** Starts one non-overlapping poll loop and returns its stop function. */
export function startAdaptivePollLoop<T extends AuditAnchorReadiness>(
  options: AdaptivePollLoopOptions<T>,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (delayMs: number) => {
    if (stopped) return;
    timer = setTimeout(() => {
      timer = null;
      void tick();
    }, delayMs);
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
      (timer as NodeJS.Timeout).unref?.();
    }
  };

  const tick = async () => {
    try {
      const result = await options.run();
      if (stopped) return;
      options.onResult(result);
      const readinessDelay = nextAuditAnchorPollDelayMs(
        options.maxIdlePollMs,
        result.nextReadinessAtMs,
      );
      schedule(options.shouldRetrySoon(result) ? options.retryDelayMs : readinessDelay);
    } catch (error) {
      if (stopped) return;
      options.onError(error);
      schedule(options.retryDelayMs);
    }
  };

  schedule(options.initialDelayMs);
  return () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
