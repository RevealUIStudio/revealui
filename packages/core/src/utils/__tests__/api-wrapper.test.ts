import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('../errors.js', () => ({
  handleApiError: vi.fn((error) => ({
    message: error instanceof Error ? error.message : 'An error occurred',
    statusCode: error?.statusCode || 500,
    code: error?.code || 'INTERNAL_ERROR',
    retryable: error?.retryable,
  })),
}));

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../request-context.js', () => ({
  createRequestContext: vi.fn((opts) => ({
    requestId: 'req-123',
    method: opts?.method || 'GET',
    path: opts?.path || '/',
    ip: opts?.ip,
    userAgent: opts?.headers?.['user-agent'],
    startTime: Date.now(),
  })),
  getRequestDuration: vi.fn(() => 42),
  runInRequestContext: vi.fn((_ctx, fn) => fn()),
}));

// Must import AFTER mocks
import { withRequestContext, withServerActionContext } from '../api-wrapper.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockRequest(
  path = '/api/users',
  method = 'GET',
  headers: Record<string, string> = {},
) {
  return new Request(`http://localhost${path}`, { method, headers });
}

// ---------------------------------------------------------------------------
// Tests  -  withRequestContext
// ---------------------------------------------------------------------------
describe('withRequestContext', () => {
  it('calls handler and returns response', async () => {
    const response = Response.json({ ok: true });
    const handler = vi.fn().mockResolvedValue(response);
    const wrapped = withRequestContext(handler);

    const result = await wrapped(createMockRequest());

    expect(handler).toHaveBeenCalledOnce();
    expect(result).toBe(response);
  });

  it('logs incoming request', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({}));
    const wrapped = withRequestContext(handler);

    await wrapped(createMockRequest('/api/posts', 'POST'));

    expect(logger.info).toHaveBeenCalledWith(
      'Incoming request',
      expect.objectContaining({
        method: 'POST',
        path: '/api/posts',
      }),
    );
  });

  it('logs successful response', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({}, { status: 201 }));
    const wrapped = withRequestContext(handler);

    await wrapped(createMockRequest());

    expect(logger.info).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        status: 201,
        duration: 42,
      }),
    );
  });

  it('sets request ID and duration headers on response', async () => {
    const response = Response.json({ ok: true });
    const handler = vi.fn().mockResolvedValue(response);
    const wrapped = withRequestContext(handler);

    const result = (await wrapped(createMockRequest())) as Response;

    expect(result.headers.get('x-request-id')).toBe('req-123');
    expect(result.headers.get('x-request-duration')).toBe('42');
  });

  it('handles errors and returns error response', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('DB timeout'));
    const wrapped = withRequestContext(handler);

    const result = (await wrapped(createMockRequest('/api/fail', 'DELETE'))) as Response;

    expect(result.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      'Request failed',
      expect.objectContaining({
        error: 'DB timeout',
      }),
    );
  });

  it('includes request ID in error response headers', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('fail'));
    const wrapped = withRequestContext(handler);

    const result = (await wrapped(createMockRequest())) as Response;

    expect(result.headers.get('x-request-id')).toBe('req-123');
  });

  it('extracts IP from x-forwarded-for header', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({}));
    const wrapped = withRequestContext(handler);

    await wrapped(createMockRequest('/api', 'GET', { 'x-forwarded-for': '1.2.3.4' }));

    const { createRequestContext } = await import('../request-context.js');
    expect(createRequestContext).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '1.2.3.4',
      }),
    );
  });

  it('handles non-Error throws', async () => {
    const handler = vi.fn().mockRejectedValue('string error');
    const wrapped = withRequestContext(handler);

    const result = (await wrapped(createMockRequest())) as Response;

    expect(result.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      'Request failed',
      expect.objectContaining({
        error: 'string error',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests  -  withServerActionContext
// ---------------------------------------------------------------------------
describe('withServerActionContext', () => {
  it('calls action with arguments and returns result', async () => {
    const action = vi.fn().mockResolvedValue({ id: '1', name: 'User' });
    const wrapped = withServerActionContext(action);

    const result = await wrapped('arg1', 42);

    expect(action).toHaveBeenCalledWith('arg1', 42);
    expect(result).toEqual({ id: '1', name: 'User' });
  });

  it('logs action start and completion', async () => {
    const namedAction = async function createUser() {
      return {};
    };
    const wrapped = withServerActionContext(namedAction);

    await wrapped();

    expect(logger.info).toHaveBeenCalledWith(
      'Server action started',
      expect.objectContaining({
        action: 'createUser',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Server action completed',
      expect.objectContaining({
        action: 'createUser',
        duration: 42,
      }),
    );
  });

  it('logs "anonymous" for unnamed actions', async () => {
    const wrapped = withServerActionContext(async () => ({}));

    await wrapped();

    expect(logger.info).toHaveBeenCalledWith(
      'Server action started',
      expect.objectContaining({
        action: 'anonymous',
      }),
    );
  });

  it('re-throws errors after logging', async () => {
    const error = new Error('Action failed');
    const action = vi.fn().mockRejectedValue(error);
    const wrapped = withServerActionContext(action);

    await expect(wrapped()).rejects.toThrow('Action failed');
    expect(logger.error).toHaveBeenCalledWith(
      'Server action failed',
      expect.objectContaining({
        error: 'Action failed',
      }),
    );
  });

  it('logs non-Error throws', async () => {
    const action = vi.fn().mockRejectedValue(42);
    const wrapped = withServerActionContext(action);

    await expect(wrapped()).rejects.toBe(42);
    expect(logger.error).toHaveBeenCalledWith(
      'Server action failed',
      expect.objectContaining({
        error: '42',
      }),
    );
  });
});
