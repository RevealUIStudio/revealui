'use client';

const ALLOWED_STRIPE_HOSTS = ['checkout.stripe.com', 'billing.stripe.com'];

/** Validate and redirect to a Stripe URL. Throws if the URL hostname is not a known Stripe domain. */
export function safeStripeRedirect(url: string): void {
  try {
    const parsed = new URL(url);
    if (ALLOWED_STRIPE_HOSTS.includes(parsed.hostname)) {
      window.location.href = url;
      return;
    }
  } catch {
    // invalid URL  -  fall through to error
  }
  throw new Error(`Refused to redirect to untrusted URL: ${url}`);
}
