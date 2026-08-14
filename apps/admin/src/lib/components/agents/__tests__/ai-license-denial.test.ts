import { describe, expect, it } from 'vitest';
import { isAiLicenseDenial } from '../ai-license-denial';

describe('isAiLicenseDenial', () => {
  it('matches the hosted A2A entitlement sentence', () => {
    expect(
      isAiLicenseDenial(
        "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
      ),
    ).toBe(true);
  });

  it('does not match other A2A errors', () => {
    expect(isAiLicenseDenial('Invalid Request')).toBe(false);
    expect(isAiLicenseDenial('LLM_NOT_CONFIGURED')).toBe(false);
  });
});
