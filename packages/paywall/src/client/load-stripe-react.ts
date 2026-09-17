export interface StripeJsModule {
  loadStripe: (key: string) => Promise<unknown>;
}

export interface StripeReactModule {
  EmbeddedCheckoutProvider: import('react').ComponentType<{
    stripe: unknown;
    options: { clientSecret: string };
    children?: import('react').ReactNode;
  }>;
  Elements: import('react').ComponentType<{
    stripe: unknown;
    options: { clientSecret: string };
    children?: import('react').ReactNode;
  }>;
  EmbeddedCheckout: import('react').ComponentType;
  PaymentElement: import('react').ComponentType;
  useStripe: () => {
    confirmPayment: (opts: Record<string, unknown>) => Promise<{
      error?: { message?: string };
      paymentIntent?: { status?: string };
    }>;
  } | null;
  useElements: () => unknown;
}

export async function loadStripeJs(): Promise<StripeJsModule | null> {
  try {
    return await import('@stripe/stripe-js');
  } catch {
    return null;
  }
}

export async function loadStripeReact(): Promise<StripeReactModule | null> {
  try {
    return await import('@stripe/react-stripe-js');
  } catch {
    return null;
  }
}
