import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertDispatchFlagConfigured } from './register-handlers.js';

describe('assertDispatchFlagConfigured', () => {
  const originalFlag = process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED;
  const originalSecret = process.env.REVEALUI_JOBS_WAKE_SECRET;

  beforeEach(() => {
    delete process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED;
    delete process.env.REVEALUI_JOBS_WAKE_SECRET;
  });

  afterEach(() => {
    if (originalFlag !== undefined) {
      process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED = originalFlag;
    } else {
      delete process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED;
    }
    if (originalSecret !== undefined) {
      process.env.REVEALUI_JOBS_WAKE_SECRET = originalSecret;
    } else {
      delete process.env.REVEALUI_JOBS_WAKE_SECRET;
    }
  });

  it('is a no-op when the flag is unset', () => {
    expect(() => assertDispatchFlagConfigured()).not.toThrow();
  });

  it('is a no-op when the flag is explicitly off', () => {
    process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED = 'false';
    expect(() => assertDispatchFlagConfigured()).not.toThrow();
  });

  it('throws when flag=true but wake secret is unset', () => {
    process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED = 'true';
    expect(() => assertDispatchFlagConfigured()).toThrow(
      /REVEALUI_JOBS_AGENT_DISPATCH_ENABLED=true requires REVEALUI_JOBS_WAKE_SECRET/,
    );
  });

  it('passes when flag=true and wake secret is set', () => {
    process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED = 'true';
    process.env.REVEALUI_JOBS_WAKE_SECRET = 'shh';
    expect(() => assertDispatchFlagConfigured()).not.toThrow();
  });

  it('treats truthy non-"true" values as off (strict equality with "true")', () => {
    process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED = '1';
    expect(() => assertDispatchFlagConfigured()).not.toThrow();
  });
});
