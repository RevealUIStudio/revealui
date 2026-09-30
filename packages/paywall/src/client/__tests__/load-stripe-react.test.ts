import { afterEach, describe, expect, it, vi } from 'vitest';

interface CheckoutJsModule {
  loadStripe: (key: string) => Promise<{ publishableKey: string }>;
}

async function loadModule(mode: { js: 'ok' | 'missing'; react: 'ok' | 'missing' }): Promise<{
  loadStripeJs: () => Promise<CheckoutJsModule | null>;
  loadStripeReact: () => Promise<Record<string, unknown> | null>;
}> {
  vi.resetModules();

  if (mode.js === 'missing') {
    vi.doMock('@stripe/stripe-js', () => {
      throw new Error('checkout sdk missing');
    });
  } else {
    vi.doMock('@stripe/stripe-js', () => ({
      loadStripe: async (key: string) => ({ publishableKey: key }),
    }));
  }

  if (mode.react === 'missing') {
    vi.doMock('@stripe/react-stripe-js', () => {
      throw new Error('checkout react bindings missing');
    });
  } else {
    vi.doMock('@stripe/react-stripe-js', () => ({
      EmbeddedCheckoutProvider: function EmbeddedCheckoutProvider() {
        return null;
      },
      Elements: function Elements() {
        return null;
      },
      EmbeddedCheckout: function EmbeddedCheckout() {
        return null;
      },
      PaymentElement: function PaymentElement() {
        return null;
      },
      useStripe: () => null,
      useElements: () => null,
    }));
  }

  return import('../load-stripe-react.js');
}

describe('lazy checkout sdk loader', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@stripe/stripe-js');
    vi.doUnmock('@stripe/react-stripe-js');
  });

  it('loads both optional modules on success', async () => {
    const { loadStripeJs, loadStripeReact } = await loadModule({ js: 'ok', react: 'ok' });

    const js = await loadStripeJs();
    const react = await loadStripeReact();

    expect(js).not.toBeNull();
    await expect(js?.loadStripe('pk_example')).resolves.toEqual({ publishableKey: 'pk_example' });
    expect(react).not.toBeNull();
    expect(typeof react?.EmbeddedCheckoutProvider).toBe('function');
    expect(typeof react?.Elements).toBe('function');
    expect(typeof react?.useStripe).toBe('function');
    expect(typeof react?.useElements).toBe('function');
  });

  it('returns null when the checkout sdk cannot be imported', async () => {
    const { loadStripeJs, loadStripeReact } = await loadModule({
      js: 'missing',
      react: 'ok',
    });

    await expect(loadStripeJs()).resolves.toBeNull();
    await expect(loadStripeReact()).resolves.not.toBeNull();
  });

  it('returns null when the react bindings cannot be imported', async () => {
    const { loadStripeJs, loadStripeReact } = await loadModule({
      js: 'ok',
      react: 'missing',
    });

    await expect(loadStripeJs()).resolves.not.toBeNull();
    await expect(loadStripeReact()).resolves.toBeNull();
  });

  it('returns null from both loaders when both modules are missing', async () => {
    const { loadStripeJs, loadStripeReact } = await loadModule({
      js: 'missing',
      react: 'missing',
    });

    await expect(loadStripeJs()).resolves.toBeNull();
    await expect(loadStripeReact()).resolves.toBeNull();
  });
});
