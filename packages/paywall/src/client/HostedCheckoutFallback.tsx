'use client';

import { createElement, type ReactElement } from 'react';

export interface HostedCheckoutFallbackProps {
  hostedCheckoutUrl?: string;
  message?: string;
}

export function HostedCheckoutFallback(props: HostedCheckoutFallbackProps): ReactElement {
  const href = props.hostedCheckoutUrl ?? '/api/billing/checkout';
  const message = props.message ?? 'Continue with Stripe Checkout';
  return createElement('a', { href }, message);
}
