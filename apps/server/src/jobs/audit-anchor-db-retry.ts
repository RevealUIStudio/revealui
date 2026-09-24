/**
 * Bounded retry for transient Neon HTTP connect failures during the
 * audit-anchor sweep (REVEALUI-SERVER-F).
 *
 * Drizzle wraps the driver error as `Failed query: ...` with the Neon
 * `fetch failed` / `Error connecting to database` error on `cause`. Schema
 * and syntax failures (SQLSTATE class 22/23/42/3D/3F) are never retried.
 */

export interface AuditAnchorDbRetryConfig {
  /** Total attempts, including the first try. */
  maxAttempts: number;
  /** First backoff delay in milliseconds. Doubles each retry. */
  baseDelayMs: number;
  /** Cap on a single backoff delay in milliseconds. */
  maxDelayMs: number;
}

export const DEFAULT_AUDIT_ANCHOR_DB_RETRY: AuditAnchorDbRetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2_000,
};

/** Hard ceiling so a mis-set env cannot stall the worker. */
export const MAX_AUDIT_ANCHOR_DB_RETRY_ATTEMPTS = 5;
export const MAX_AUDIT_ANCHOR_DB_RETRY_DELAY_MS = 10_000;

const MAX_CAUSE_DEPTH = 8;

const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ECONNABORTED',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '57P01',
  '57P02',
  '57P03',
  '53300',
]);

const TRANSIENT_MESSAGE_SNIPPETS = [
  'fetch failed',
  'Error connecting to database',
  'Connect Timeout Error',
  'socket hang up',
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'the database system is starting up',
  'Connection terminated unexpectedly',
  'Client network socket disconnected',
] as const;

const NON_RETRYABLE_SQLSTATE_PREFIXES = ['22', '23', '42', '3D', '3F'] as const;

export function defaultDbRetrySleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function resolveAuditAnchorDbRetry(
  env: Record<string, string | undefined>,
  overrides?: Partial<AuditAnchorDbRetryConfig>,
): AuditAnchorDbRetryConfig {
  const fromEnv: AuditAnchorDbRetryConfig = {
    maxAttempts: positiveIntFromEnv(
      env.AUDIT_ANCHOR_DB_RETRY_ATTEMPTS,
      DEFAULT_AUDIT_ANCHOR_DB_RETRY.maxAttempts,
    ),
    baseDelayMs: positiveIntFromEnv(
      env.AUDIT_ANCHOR_DB_RETRY_BASE_MS,
      DEFAULT_AUDIT_ANCHOR_DB_RETRY.baseDelayMs,
    ),
    maxDelayMs: positiveIntFromEnv(
      env.AUDIT_ANCHOR_DB_RETRY_MAX_MS,
      DEFAULT_AUDIT_ANCHOR_DB_RETRY.maxDelayMs,
    ),
  };
  const merged: AuditAnchorDbRetryConfig = {
    maxAttempts: overrides?.maxAttempts ?? fromEnv.maxAttempts,
    baseDelayMs: overrides?.baseDelayMs ?? fromEnv.baseDelayMs,
    maxDelayMs: overrides?.maxDelayMs ?? fromEnv.maxDelayMs,
  };
  return {
    maxAttempts: clamp(merged.maxAttempts, 1, MAX_AUDIT_ANCHOR_DB_RETRY_ATTEMPTS),
    baseDelayMs: clamp(merged.baseDelayMs, 0, MAX_AUDIT_ANCHOR_DB_RETRY_DELAY_MS),
    maxDelayMs: clamp(merged.maxDelayMs, 0, MAX_AUDIT_ANCHOR_DB_RETRY_DELAY_MS),
  };
}

/**
 * True only for connect/fetch failures. SQLSTATE classes that mean the
 * statement itself is wrong return false even if a wrapper mentions the network.
 */
export function isTransientDbConnectError(err: unknown): boolean {
  const frames = errorFrames(err);
  for (const frame of frames) {
    const code = readStringField(frame, 'code');
    if (code && isNonRetryableSqlState(code)) return false;
  }
  for (const frame of frames) {
    const code = readStringField(frame, 'code');
    if (code && TRANSIENT_CODES.has(code)) return true;
    if (messageIsTransient(readMessage(frame))) return true;
  }
  return false;
}

/** Drizzle `Failed query` or a Postgres SQLSTATE that is not a connect class. */
export function isSqlOrQueryError(err: unknown): boolean {
  if (isTransientDbConnectError(err)) return false;
  for (const frame of errorFrames(err)) {
    const code = readStringField(frame, 'code');
    if (code && isSqlState(code)) return true;
    const message = readMessage(frame);
    if (message.startsWith('Failed query:')) return true;
  }
  return false;
}

export async function withTransientDbRetry<T>(
  op: () => Promise<T>,
  config: AuditAnchorDbRetryConfig = DEFAULT_AUDIT_ANCHOR_DB_RETRY,
  sleep: (ms: number) => Promise<void> = defaultDbRetrySleep,
): Promise<T> {
  const maxAttempts = clamp(config.maxAttempts, 1, MAX_AUDIT_ANCHOR_DB_RETRY_ATTEMPTS);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isTransientDbConnectError(err)) {
        throw err;
      }
      await sleep(backoffMs(attempt, config));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function backoffMs(failedAttempt: number, config: AuditAnchorDbRetryConfig): number {
  const shift = Math.max(0, failedAttempt - 1);
  const doubled = config.baseDelayMs * 2 ** Math.min(shift, 16);
  return Math.min(doubled, config.maxDelayMs);
}

function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function errorFrames(err: unknown): object[] {
  const frames: object[] = [];
  const seen = new Set<object>();
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (!current || typeof current !== 'object') break;
    if (seen.has(current)) break;
    seen.add(current);
    frames.push(current);
    const rec = current as { cause?: unknown; sourceError?: unknown };
    const next = rec.cause ?? rec.sourceError;
    if (next === undefined) break;
    current = next;
  }
  return frames;
}

function readStringField(frame: object, key: string): string | undefined {
  if (!(key in frame)) return undefined;
  const value = (frame as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function readMessage(frame: object): string {
  if (frame instanceof Error) return frame.message;
  return readStringField(frame, 'message') ?? '';
}

function messageIsTransient(message: string): boolean {
  for (const snippet of TRANSIENT_MESSAGE_SNIPPETS) {
    if (message.includes(snippet)) return true;
  }
  return false;
}

function isSqlState(code: string): boolean {
  if (code.length !== 5) return false;
  for (const ch of code) {
    const upper = ch >= 'A' && ch <= 'Z';
    const digit = ch >= '0' && ch <= '9';
    if (!(upper || digit)) return false;
  }
  return true;
}

function isNonRetryableSqlState(code: string): boolean {
  if (!isSqlState(code)) return false;
  for (const prefix of NON_RETRYABLE_SQLSTATE_PREFIXES) {
    if (code.startsWith(prefix)) return true;
  }
  return false;
}
