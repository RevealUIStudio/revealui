'use client';

import { createElement, type ReactElement, useEffect, useState } from 'react';

import { HostedCheckoutFallback } from './HostedCheckoutFallback.js';
import { loadStripeJs, loadStripeReact } from './load-stripe-react.js';

export interface EmbeddedCheckoutProps {
  /** Checkout Session client_secret from POST /api/billing/checkout?ui=embedded */
  sessionId: string;
  publishableKey: string;
  onComplete?: () => void;
  fallbackToHosted?: boolean;
  hostedCheckoutUrl?: string;
}

/**
 * Stripe Embedded Checkout (on-domain iframe). Optional peer
 * `@stripe/react-stripe-js` — Hosted Checkout consumers do not import this file.
 */
export function EmbeddedCheckout(props: EmbeddedCheckoutProps): ReactElement {
  const fallback = props.fallbackToHosted !== false;
  const [ready, setReady] = useState<{
    stripe: unknown;
    react: NonNullable<Awaited<ReturnType<typeof loadStripeReact>>>;
  } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [js, react] = await Promise.all([loadStripeJs(), loadStripeReact()]);
      if (cancelled) return;
      if (!(js && react)) {
        setMissing(true);
        return;
      }
      const stripe = await js.loadStripe(props.publishableKey);
      if (cancelled) return;
      if (!stripe) {
        setMissing(true);
        return;
      }
      setReady({ stripe, react });
    })();
    return () => {
      cancelled = true;
    };
  }, [props.publishableKey]);

  if (missing) {
    if (!fallback) return createElement('span', null, 'Stripe.js is not installed');
    return createElement(HostedCheckoutFallback, { hostedCheckoutUrl: props.hostedCheckoutUrl });
  }
  if (!ready) return createElement('span', null, 'Loading checkout');

  const { EmbeddedCheckoutProvider, EmbeddedCheckout: StripeEmbeddedCheckout } = ready.react;
  return createElement(
    EmbeddedCheckoutProvider,
    { stripe: ready.stripe, options: { clientSecret: props.sessionId } },
    createElement(StripeEmbeddedCheckout),
  );
}
