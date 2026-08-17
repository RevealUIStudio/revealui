/**
 * Stripe connectivity probe used by seed-stripe.ts.
 *
 * Kept out of seed-stripe.ts so tests can import it without loading
 * @revealui/contracts or running the CLI dotenv side effects.
 */

/** Minimal Stripe surface the connectivity probe uses. */
export interface StripeConnectionProbe {
  products: { list: (params: { active: boolean; limit: number }) => Promise<unknown> };
  balance: { retrieve: () => Promise<unknown> };
}

/**
 * Connectivity probe before seed/check work.
 *
 * Mutating runs use balance.retrieve() (full sk_* keys have balance_read).
 * `--check` uses products.list — the same catalog endpoint the drift gate
 * reads — so a least-privilege restricted live key does not need balance_read.
 */
export async function probeStripeConnection(
  stripe: StripeConnectionProbe,
  checkMode: boolean,
): Promise<void> {
  if (checkMode) {
    await stripe.products.list({ active: true, limit: 1 });
    return;
  }
  await stripe.balance.retrieve();
}
