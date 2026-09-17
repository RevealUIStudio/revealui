'use client';

import { createElement, type FormEvent, type ReactElement, useEffect, useState } from 'react';

import { HostedCheckoutFallback } from './HostedCheckoutFallback.js';
import { loadStripeJs, loadStripeReact, type StripeReactModule } from './load-stripe-react.js';

export interface PaymentElementProps {
  clientSecret: string;
  publishableKey: string;
  returnUrl: string;
  onSuccess?: (paymentIntent: { status?: string }) => void;
  onError?: (error: { message?: string }) => void;
  fallbackToHosted?: boolean;
  hostedCheckoutUrl?: string;
}

function PaymentElementForm(props: {
  react: StripeReactModule;
  returnUrl: string;
  onSuccess?: PaymentElementProps['onSuccess'];
  onError?: PaymentElementProps['onError'];
}): ReactElement {
  const stripe = props.react.useStripe();
  const elements = props.react.useElements();

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!(stripe && elements)) return;
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: props.returnUrl },
      redirect: 'if_required',
    });
    if (result.error) {
      props.onError?.(result.error);
      return;
    }
    if (result.paymentIntent) props.onSuccess?.(result.paymentIntent);
  }

  return createElement(
    'form',
    { onSubmit },
    createElement(props.react.PaymentElement),
    createElement('button', { type: 'submit' }, 'Pay'),
  );
}

/**
 * Stripe Payment Element. Optional peer `@stripe/react-stripe-js`.
 */
export function PaymentElement(props: PaymentElementProps): ReactElement {
  const fallback = props.fallbackToHosted !== false;
  const [ready, setReady] = useState<{ stripe: unknown; react: StripeReactModule } | null>(null);
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
  if (!ready) return createElement('span', null, 'Loading payment form');

  const { Elements } = ready.react;
  return createElement(
    Elements,
    { stripe: ready.stripe, options: { clientSecret: props.clientSecret } },
    createElement(PaymentElementForm, {
      react: ready.react,
      returnUrl: props.returnUrl,
      onSuccess: props.onSuccess,
      onError: props.onError,
    }),
  );
}
