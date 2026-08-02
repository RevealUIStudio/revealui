import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogger, mockLogError } = vi.hoisted(() => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    setContext: vi.fn(),
    clearContext: vi.fn(),
    child: vi.fn(),
    addLogHandler: vi.fn(),
  };
  const mockLogError = vi.fn();
  return { mockLogger, mockLogError };
});

vi.mock('../logger.js', () => ({
  logger: mockLogger,
  logError: mockLogError,
}));

import {
  bindRequestId,
  captureActionFailure,
  captureException,
  captureMessage,
  initBrowserObservability,
  initNodeObservability,
  resetObservabilityInstallFlagsForTests,
  sanitizeCaptureContext,
} from '../capture.js';

beforeEach(() => {
  vi.clearAllMocks();
  resetObservabilityInstallFlagsForTests();
});

afterEach(() => {
  resetObservabilityInstallFlagsForTests();
});

describe('sanitizeCaptureContext', () => {
  it('strips secret-shaped keys and keeps actionId', () => {
    const out = sanitizeCaptureContext({
      actionId: 'act_1',
      password: 'nope',
      body: { secret: true },
      formData: new FormData(),
      pathname: '/actions',
    });
    expect(out).toEqual({ actionId: 'act_1', pathname: '/actions' });
  });
});

describe('captureException / captureMessage / captureActionFailure', () => {
  it('captureException logs via logError', () => {
    const err = new Error('boom');
    captureException(err, { kind: 'test' });
    expect(mockLogError).toHaveBeenCalledWith(err, { kind: 'test' });
  });

  it('captureException coerces non-Error', () => {
    captureException('string fail');
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'string fail' }),
      undefined,
    );
  });

  it('captureMessage uses logger.info', () => {
    captureMessage('hello', { service: 'rsc-poc' });
    expect(mockLogger.info).toHaveBeenCalledWith('hello', { service: 'rsc-poc' });
  });

  it('captureActionFailure tags action id and never needs body', () => {
    const err = new Error('action failed');
    captureActionFailure('server-action-id', err, { password: 'x' });
    expect(mockLogError).toHaveBeenCalledWith(err, {
      actionId: 'server-action-id',
      kind: 'action_failure',
    });
  });
});

describe('bindRequestId', () => {
  it('sets requestId on logger when present', () => {
    bindRequestId('req-abc');
    expect(mockLogger.setContext).toHaveBeenCalledWith({ requestId: 'req-abc' });
  });

  it('no-ops on empty', () => {
    bindRequestId('');
    bindRequestId(null);
    expect(mockLogger.setContext).not.toHaveBeenCalled();
  });
});

describe('initNodeObservability', () => {
  it('sets service context and logs init', () => {
    initNodeObservability({ service: 'rsc-poc', installProcessHandlers: false });
    expect(mockLogger.setContext).toHaveBeenCalledWith({ service: 'rsc-poc', runtime: 'node' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      'observability: node init',
      expect.objectContaining({ service: 'rsc-poc', runtime: 'node' }),
    );
  });
});

describe('initBrowserObservability', () => {
  it('sets service context and logs init', () => {
    initBrowserObservability({ service: 'rsc-poc', installWindowHandlers: false });
    expect(mockLogger.setContext).toHaveBeenCalledWith({
      service: 'rsc-poc',
      runtime: 'browser',
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      'observability: browser init',
      expect.objectContaining({ service: 'rsc-poc', runtime: 'browser' }),
    );
  });
});
