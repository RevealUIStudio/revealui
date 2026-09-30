/**
 * @vitest-environment jsdom
 */
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EmbeddedCheckout } from '../EmbeddedCheckout.js';
import { HostedCheckoutFallback } from '../HostedCheckoutFallback.js';
import { mount, waitForText } from './mount.js';

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
    EmbeddedCheckoutProvider: (props: {
      children?: ReactNode;
      options: { clientSecret: string };
    }) =>
      createElement(
        'div',
        { 'data-provider': 'embedded', 'data-secret': props.options.clientSecret },
        props.children,
      ),
    EmbeddedCheckout: () => createElement('div', { 'data-widget': 'embedded-checkout' }, 'ready'),
    Elements: () => null,
    PaymentElement: () => null,
    useStripe: () => null,
    useElements: () => null,
  };
}

describe('HostedCheckoutFallback', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('points at the hosted checkout URL', () => {
    const el = createElement(HostedCheckoutFallback, {
      hostedCheckoutUrl: 'https://checkout.example/hosted',
      message: 'Continue with hosted checkout',
    });
    expect(el.props.hostedCheckoutUrl).toBe('https://checkout.example/hosted');
    expect(el.props.message).toBe('Continue with hosted checkout');
  });

  it('renders the default hosted checkout link', async () => {
    const view = await mount(createElement(HostedCheckoutFallback, {}));
    const link = view.host.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/api/billing/checkout');
    expect(link?.textContent).toBe('Continue with Stripe Checkout');
    await view.unmount();
  });
});

describe('EmbeddedCheckout', () => {
  afterEach(() => {
    document.body.replaceChildren();
    loader.loadStripeJs = async () => null;
    loader.loadStripeReact = async () => null;
  });

  it('renders the embedded checkout after both modules load', async () => {
    const loadStripe = vi.fn(async (key: string) => ({ key }));
    loader.loadStripeJs = async () => ({ loadStripe });
    loader.loadStripeReact = async () => reactBindings();

    const view = await mount(
      createElement(EmbeddedCheckout, {
        sessionId: 'cs_session_example',
        publishableKey: 'pk_example',
      }),
    );

    await waitForText(view.host, 'ready');
    expect(view.host.querySelector('[data-provider="embedded"]')?.getAttribute('data-secret')).toBe(
      'cs_session_example',
    );
    expect(loadStripe).toHaveBeenCalledWith('pk_example');
    await view.unmount();
  });

  it('reloads when the publishable key changes', async () => {
    const loadStripe = vi.fn(async (key: string) => ({ key }));
    loader.loadStripeJs = async () => ({ loadStripe });
    loader.loadStripeReact = async () => reactBindings();

    const view = await mount(
      createElement(EmbeddedCheckout, {
        sessionId: 'cs_session_example',
        publishableKey: 'pk_first',
      }),
    );
    await waitForText(view.host, 'ready');
    await view.rerender(
      createElement(EmbeddedCheckout, {
        sessionId: 'cs_session_example',
        publishableKey: 'pk_second',
      }),
    );
    await vi.waitFor(() => {
      expect(loadStripe).toHaveBeenCalledWith('pk_second');
    });
    await view.unmount();
  });

  it('shows the hosted fallback when the checkout sdk is missing', async () => {
    loader.loadStripeJs = async () => null;
    loader.loadStripeReact = async () => reactBindings();

    const view = await mount(
      createElement(EmbeddedCheckout, {
        sessionId: 'cs_session_example',
        publishableKey: 'pk_example',
        hostedCheckoutUrl: 'https://checkout.example/hosted',
      }),
    );

    await waitForText(view.host, 'Continue with Stripe Checkout');
    expect(view.host.querySelector('a')?.getAttribute('href')).toBe(
      'https://checkout.example/hosted',
    );
    await view.unmount();
  });

  it('shows the hosted fallback when react bindings are missing', async () => {
    loader.loadStripeJs = async () => ({
      loadStripe: async () => ({ key: 'pk_example' }),
    });
    loader.loadStripeReact = async () => null;

    const view = await mount(
      createElement(EmbeddedCheckout, {
        sessionId: 'cs_session_example',
        publishableKey: 'pk_example',
      }),
    );

    await waitForText(view.host, 'Continue with Stripe Checkout');
    expect(view.host.querySelector('a')?.getAttribute('href')).toBe('/api/billing/checkout');
    await view.unmount();
  });

  it('shows the hosted fallback when the sdk returns no instance', async () => {
    loader.loadStripeJs = async () => ({
      loadStripe: async () => null,
    });
    loader.loadStripeReact = async () => reactBindings();

    const view = await mount(
      createElement(EmbeddedCheckout, {
        sessionId: 'cs_session_example',
        publishableKey: 'pk_example',
        fallbackToHosted: true,
      }),
    );

    await waitForText(view.host, 'Continue with Stripe Checkout');
    await view.unmount();
  });

  it('shows a denial message when fallback is disabled and the sdk is missing', async () => {
    loader.loadStripeJs = async () => null;
    loader.loadStripeReact = async () => null;

    const view = await mount(
      createElement(EmbeddedCheckout, {
        sessionId: 'cs_session_example',
        publishableKey: 'pk_example',
        fallbackToHosted: false,
      }),
    );

    await waitForText(view.host, 'Stripe.js is not installed');
    expect(view.host.querySelector('a')).toBeNull();
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
      createElement(EmbeddedCheckout, {
        sessionId: 'cs_session_example',
        publishableKey: 'pk_example',
      }),
    );
    expect(view.host.textContent).toContain('Loading checkout');
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
      createElement(EmbeddedCheckout, {
        sessionId: 'cs_session_example',
        publishableKey: 'pk_example',
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
