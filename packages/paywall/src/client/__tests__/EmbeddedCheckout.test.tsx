import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { HostedCheckoutFallback } from '../HostedCheckoutFallback.js';

describe('HostedCheckoutFallback', () => {
  it('points at the hosted checkout URL', () => {
    const el = createElement(HostedCheckoutFallback, {
      hostedCheckoutUrl: 'https://checkout.example/hosted',
      message: 'Continue with Stripe Checkout',
    });
    expect(el.props.href).toBe('https://checkout.example/hosted');
    expect(el.props.children).toBe('Continue with Stripe Checkout');
  });
});
