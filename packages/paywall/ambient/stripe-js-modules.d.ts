declare module '@stripe/react-stripe-js' {
  import type { ComponentType, ReactNode } from 'react';

  export const EmbeddedCheckoutProvider: ComponentType<{
    stripe: unknown;
    options: { clientSecret: string };
    children?: ReactNode;
  }>;
  export const Elements: ComponentType<{
    stripe: unknown;
    options: { clientSecret: string };
    children?: ReactNode;
  }>;
  export const EmbeddedCheckout: ComponentType;
  export const PaymentElement: ComponentType;
  export function useStripe(): {
    confirmPayment: (opts: Record<string, unknown>) => Promise<{
      error?: { message?: string };
      paymentIntent?: { status?: string };
    }>;
  } | null;
  export function useElements(): unknown;
}

declare module '@stripe/stripe-js' {
  export function loadStripe(key: string): Promise<unknown>;
}
