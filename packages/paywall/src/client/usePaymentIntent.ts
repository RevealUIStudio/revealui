import { useEffect, useState } from 'react';

export interface UsePaymentIntentOptions {
  endpoint?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  fetchImpl?: typeof fetch;
}

export interface UsePaymentIntentResult {
  clientSecret: string | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Fetch a PaymentIntent / incomplete-subscription client_secret from the host.
 */
export function usePaymentIntent(opts: UsePaymentIntentOptions = {}): UsePaymentIntentResult {
  const endpoint = opts.endpoint ?? '/api/billing/payment-intent';
  const fetchImpl = opts.fetchImpl ?? fetch;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: opts.subscriptionId,
            amount: opts.amount,
            currency: opts.currency,
          }),
        });
        if (!res.ok) {
          throw new Error(`payment-intent failed (${res.status})`);
        }
        const data = (await res.json()) as { clientSecret?: string };
        if (cancelled) return;
        setClientSecret(data.clientSecret ?? null);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setClientSecret(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint, opts.subscriptionId, opts.amount, opts.currency, fetchImpl]);

  return { clientSecret, loading, error };
}
