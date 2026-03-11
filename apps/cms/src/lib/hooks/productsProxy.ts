import type { RevealHandler, RevealRequest } from '@revealui/core';
import type Stripe from 'stripe';
import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from '../access/roles/hasRole';

const logs = process.env.STRIPE_PROXY === '1';

// use this handler to get all Stripe products
// prevents unauthorized or non-admin users from accessing all Stripe products
// GET /api/products
export const productsProxy: RevealHandler = async (req: RevealRequest): Promise<Response> => {
  if (!(req.user && hasRole(req.user, [Role.UserSuperAdmin, Role.UserAdmin]))) {
    if (logs) req?.revealui?.logger?.error('You are not authorized to access products');
    return new Response('You are not authorized to access products', {
      status: 401,
    });
  }

  const services = await import('@revealui/services').catch(() => null);
  if (!services) {
    return new Response('Stripe features require @revealui/services (Pro)', {
      status: 503,
    });
  }

  try {
    const listParams: Stripe.ProductListParams = {
      limit: 100,
    };
    const products = await services.protectedStripe.products.list(listParams);

    return new Response(JSON.stringify(products), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (logs) req?.revealui?.logger?.error(`Error using Stripe API: ${errorMessage}`);
    return new Response(`Error using Stripe API: ${errorMessage}`, {
      status: 500,
    });
  }
};
