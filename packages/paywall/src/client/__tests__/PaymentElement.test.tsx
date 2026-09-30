/**
 * @vitest-environment jsdom
 */
import { act, createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PaymentElement } from '../PaymentElement.js';
import { mount, waitForText } from './mount.js';

interface ConfirmResult {
  error?: { message?: string };
  paymentIntent?: { status?: string };
}

const payment = vi.hoisted(() => ({
  stripe: null as null | {
    confirmPayment: (opts: Record<string, unknown>) => Promise<ConfirmResult>;
  },
  elements: null as unknown,
}));

const loader = vi.hoisted(() => ({
  loadStripeJs: async (): Promise<{ loadStripe: (key: string) => Promise<unknown> } | null> => null,
  loadStripeReact: async (): Promise<Record<string, unknown> | null> => null,
}));

vi.mock('../load-stripe-react.js', () => ({
  loadStripeJs: () => loader.loadStripeJs(),
  loadStripeReact: () => loader.loadStripeReact(),
}));

function reactBindings(): Record<string, unknown> {
  return {
    Elements: (props: { children?: ReactNode; options: { clientSecret: string } }) =>
      createElement(
        'div',
        { 'data-provider': 'elements', 'data-secret': props.options.clientSecret },
        props.children,
      ),
    PaymentElement: () => createElement('div', { 'data-widget': 'payment-element' }),
    EmbeddedCheckoutProvider: () => null,
    EmbeddedCheckout: () => null,
    useStripe: () => payment.stripe,
    useElements: () => payment.elements,
  };
}

function readyLoaders(): void {
  loader.loadStripeJs = async () => ({
    loadStripe: async (key: string) => ({ key }),
  });
  loader.loadStripeReact = async () => reactBindings();
}

async function submit(host: ParentNode): Promise<void> {
  await act(async () => {
    host.querySelector('button')?.click();
  });
}

describe('PaymentElement', () => {
  afterEach(() => {
    document.body.replaceChildren();
    payment.stripe = null;
    payment.elements = null;
    loader.loadStripeJs = async () => null;
    loader.loadStripeReact = async () => null;
  });

  it('renders the payment form after both modules load', async () => {
    const loadStripe = vi.fn(async (key: string) => ({ key }));
    loader.loadStripeJs = async () => ({ loadStripe });
    loader.loadStripeReact = async () => reactBindings();
    payment.stripe = { confirmPayment: vi.fn(async () => ({})) };
    payment.elements = { id: 'elements' };

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
      }),
    );

    await waitForText(view.host, 'Pay');
    expect(view.host.querySelector('[data-widget="payment-element"]')).not.toBeNull();
    expect(view.host.querySelector('[data-provider="elements"]')?.getAttribute('data-secret')).toBe(
      'pi_secret_example',
    );
    expect(loadStripe).toHaveBeenCalledWith('pk_example');
    await view.unmount();
  });

  it('reports success when confirmation returns a payment intent', async () => {
    readyLoaders();
    const confirmPayment = vi.fn(async () => ({ paymentIntent: { status: 'succeeded' } }));
    payment.stripe = { confirmPayment };
    payment.elements = { id: 'elements' };
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
        onSuccess,
        onError,
      }),
    );
    await waitForText(view.host, 'Pay');
    await submit(view.host);

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ status: 'succeeded' });
    });
    expect(onError).not.toHaveBeenCalled();
    expect(confirmPayment).toHaveBeenCalledWith({
      elements: { id: 'elements' },
      confirmParams: { return_url: 'https://buyer.example/return' },
      redirect: 'if_required',
    });
    await view.unmount();
  });

  it('reports a denial when confirmation returns an error', async () => {
    readyLoaders();
    payment.stripe = {
      confirmPayment: vi.fn(async () => ({ error: { message: 'card declined' } })),
    };
    payment.elements = { id: 'elements' };
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
        onSuccess,
        onError,
      }),
    );
    await waitForText(view.host, 'Pay');
    await submit(view.host);

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith({ message: 'card declined' });
    });
    expect(onSuccess).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('does not call handlers when confirmation returns neither error nor intent', async () => {
    readyLoaders();
    payment.stripe = { confirmPayment: vi.fn(async () => ({})) };
    payment.elements = { id: 'elements' };
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
        onSuccess,
        onError,
      }),
    );
    await waitForText(view.host, 'Pay');
    await submit(view.host);
    await Promise.resolve();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('does not confirm when the sdk or elements are unavailable', async () => {
    readyLoaders();
    const confirmPayment = vi.fn(async () => ({ paymentIntent: { status: 'succeeded' } }));
    payment.stripe = null;
    payment.elements = { id: 'elements' };

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
      }),
    );
    await waitForText(view.host, 'Pay');
    await submit(view.host);
    expect(confirmPayment).not.toHaveBeenCalled();

    payment.stripe = { confirmPayment };
    payment.elements = null;
    await view.rerender(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example_rerender',
        returnUrl: 'https://buyer.example/return',
      }),
    );
    await waitForText(view.host, 'Pay');
    await submit(view.host);
    expect(confirmPayment).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('shows the hosted fallback when a module is missing', async () => {
    loader.loadStripeJs = async () => null;
    loader.loadStripeReact = async () => reactBindings();

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
        hostedCheckoutUrl: 'https://checkout.example/hosted',
      }),
    );
    await waitForText(view.host, 'Continue with Stripe Checkout');
    expect(view.host.querySelector('a')?.getAttribute('href')).toBe(
      'https://checkout.example/hosted',
    );
    await view.unmount();
  });

  it('shows the hosted fallback when the instance is missing', async () => {
    loader.loadStripeJs = async () => ({
      loadStripe: async () => null,
    });
    loader.loadStripeReact = async () => reactBindings();

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
      }),
    );
    await waitForText(view.host, 'Continue with Stripe Checkout');
    expect(view.host.querySelector('a')?.getAttribute('href')).toBe('/api/billing/checkout');
    await view.unmount();
  });

  it('shows a denial message when fallback is disabled', async () => {
    loader.loadStripeJs = async () => ({
      loadStripe: async () => ({ key: 'pk_example' }),
    });
    loader.loadStripeReact = async () => null;

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
        fallbackToHosted: false,
      }),
    );
    await waitForText(view.host, 'Stripe.js is not installed');
    await view.unmount();
  });

  it('ignores a late sdk response after unmount', async () => {
    let releaseJs: (value: { loadStripe: (key: string) => Promise<unknown> }) => void = () => {};
    loader.loadStripeJs = () =>
      new Promise((resolve) => {
        releaseJs = resolve;
      });
    loader.loadStripeReact = async () => reactBindings();

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
      }),
    );
    expect(view.host.textContent).toContain('Loading payment form');
    await view.unmount();
    releaseJs({ loadStripe: async () => ({ key: 'pk_example' }) });
    await Promise.resolve();
  });

  it('ignores a late instance after unmount', async () => {
    let releaseStripe: (value: unknown) => void = () => {};
    let started = false;
    loader.loadStripeJs = async () => ({
      loadStripe: () => {
        started = true;
        return new Promise((resolve) => {
          releaseStripe = resolve;
        });
      },
    });
    loader.loadStripeReact = async () => reactBindings();

    const view = await mount(
      createElement(PaymentElement, {
        clientSecret: 'pi_secret_example',
        publishableKey: 'pk_example',
        returnUrl: 'https://buyer.example/return',
      }),
    );
    await vi.waitFor(() => {
      expect(started).toBe(true);
    });
    await view.unmount();
    releaseStripe({ key: 'pk_example' });
    await Promise.resolve();
  });
});
