import { describe, expect, it } from 'vitest';

import { usePaymentIntent } from '../usePaymentIntent.js';

describe('usePaymentIntent', () => {
  it('exports a hook function', () => {
    expect(typeof usePaymentIntent).toBe('function');
  });
});
