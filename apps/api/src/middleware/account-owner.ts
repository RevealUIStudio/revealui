/**
 * Account-owner gate for billing mutations.
 *
 * `accountMemberships.role` scopes platform-level authorization at the account
 * boundary. Billing actions (checkout, upgrade, downgrade, pause, resume,
 * perpetual/credit/support-renewal checkouts, RVUI payment) mutate the
 * subscription, credits, and license attached to the account — all of which
 * can land real charges on the owner's card or disable access for every other
 * member. Only the account owner should be able to trigger them.
 *
 * Pre-account users (membershipRole === null) pass through — they have no
 * membership yet, typically because they are about to sign up via `/checkout`
 * and the Stripe webhook (`ensureHostedAccount` in webhooks.ts) will create
 * the account + assign them the `'owner'` role on successful subscription
 * creation. Blocking them here would break the first-time signup flow.
 *
 * Members with any role other than `'owner'` (e.g. seats added by the owner)
 * receive 403.
 *
 * Platform admins (`user.role === 'admin'`) are NOT auto-bypassed here —
 * admin-only actions like `/refund` keep their own `user.role` check. The
 * separation is deliberate: `user.role` governs platform capabilities,
 * `membershipRole` governs per-account authorization. Admins who need to
 * issue a refund use the admin-only route; they do not act on behalf of a
 * customer via this middleware.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { getEntitlementsFromContext } from './entitlements.js';

/**
 * Inline assertion — throws 403 if the caller has a non-owner membership.
 * No-op for pre-account users (no membership yet).
 *
 * Use this inside route handlers that don't otherwise consume entitlements,
 * so the security check stays co-located with the business logic.
 */
export function assertAccountOwner(c: Context): void {
  const entitlements = getEntitlementsFromContext(c);

  // Pre-account users: no membership row yet. Allow through so the Stripe
  // webhook can create the account + assign owner on successful signup.
  if (entitlements.membershipRole === null) {
    return;
  }

  if (entitlements.membershipRole !== 'owner') {
    throw new HTTPException(403, {
      message: 'Only the account owner can change billing',
    });
  }
}

/**
 * Middleware-shaped variant of the same check, for routes mounted via
 * `app.use()`. Prefer `assertAccountOwner(c)` inside OpenAPI handlers.
 */
export const requireAccountOwner = (): MiddlewareHandler => {
  return async (c, next) => {
    assertAccountOwner(c);
    await next();
  };
};
