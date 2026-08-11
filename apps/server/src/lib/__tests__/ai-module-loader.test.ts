import { describe, expect, it } from 'vitest';
import {
  AI_MODULE_UNAVAILABLE_CODE,
  AI_RESOLVE_FAILED_CODE,
  aiModuleUnavailableBody,
  aiResolveFailedBody,
} from '../ai-module-loader.js';

describe('ai-module-loader honest error bodies', () => {
  it('aiModuleUnavailableBody never claims Free or Pro upgrade', () => {
    const body = aiModuleUnavailableBody();
    expect(body.success).toBe(false);
    expect(body.code).toBe(AI_MODULE_UNAVAILABLE_CODE);
    expect(body.error).not.toMatch(/Free plan|requires a Pro or Enterprise license/i);
    expect(body.error).toMatch(/not available in this deployment/i);
  });

  it('aiResolveFailedBody never claims Free or Pro upgrade', () => {
    const body = aiResolveFailedBody();
    expect(body.success).toBe(false);
    expect(body.code).toBe(AI_RESOLVE_FAILED_CODE);
    expect(body.error).not.toMatch(/Free plan|requires a Pro or Enterprise license/i);
    expect(body.error).toMatch(/API keys/i);
  });

  it('optional detail is appended without changing the code', () => {
    const body = aiModuleUnavailableBody('dispatcher unavailable');
    expect(body.code).toBe(AI_MODULE_UNAVAILABLE_CODE);
    expect(body.error).toContain('dispatcher unavailable');
  });
});
