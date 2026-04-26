import type { RevealHandler, RevealRequest, RevealUser } from '@revealui/core';
import type Stripe from 'stripe';
import { Role } from '@/lib/access/permissions/roles';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response-handler';
import { hasRole } from '../access/roles/hasRole';
import { CustomerCreateSchema, CustomerUpdateSchema } from '../validation/stripe-schemas';

interface CustomUser extends RevealUser {
  stripeCustomerID?: string;
}

const logs = process.env.STRIPE_PROXY === '1';

// Handler to get all Stripe customers
// GET /api/customers
export const customersProxy: RevealHandler = async (req: RevealRequest): Promise<Response> => {
  if (!(req.user && hasRole(req.user, [Role.UserSuperAdmin]))) {
    return createApplicationErrorResponse(
      'You are not authorized to access customers',
      'UNAUTHORIZED',
      401,
    );
  }

  const services = await import('@revealui/services').catch(() => null);
  if (!services) {
    return new Response('Stripe features require @revealui/services (Pro)', {
      status: 503,
    });
  }

  try {
    const customers = await services.protectedStripe.customers.list({ limit: 100 });
    return new Response(JSON.stringify(customers), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return createErrorResponse(error, {
      endpoint: '/api/customers',
      operation: 'list_customers',
    });
  }
};

// Handler to interact with a specific Stripe customer associated with a user
// GET /api/users/:id/customer
// POST /api/users/:id/customer
// PATCH /api/users/:id/customer
// DELETE /api/users/:id/customer
export const customerProxy: RevealHandler = async (req: RevealRequest) => {
  const userID = req.query?.id as string | undefined;

  const user = req.user as CustomUser;

  if (!user) {
    return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  }

  if (!user.id) {
    return createApplicationErrorResponse(`No ID found for user ${userID}`, 'USER_NOT_FOUND', 404);
  }

  const services = await import('@revealui/services').catch(() => null);
  if (!services) {
    return new Response('Stripe features require @revealui/services (Pro)', {
      status: 503,
    });
  }

  if (!user.stripeCustomerID) {
    return createApplicationErrorResponse(
      'No Stripe customer linked to this account. Purchase a subscription first.',
      'STRIPE_CUSTOMER_NOT_FOUND',
      400,
    );
  }
  const customerID = user.stripeCustomerID;

  try {
    let response:
      | Stripe.Customer
      | Stripe.DeletedCustomer
      | Stripe.ApiList<Stripe.Customer | Stripe.DeletedCustomer>;

    const customer = await (
      services.protectedStripe.customers.retrieve as (
        id: string,
        params?: Stripe.CustomerRetrieveParams,
      ) => Promise<Stripe.Customer | Stripe.DeletedCustomer>
    )(customerID.toString(), {
      expand: ['invoice_settings.default_payment_method'],
    });

    if (customer?.deleted) {
      return createApplicationErrorResponse('Customer not found', 'CUSTOMER_NOT_FOUND', 404);
    }

    if (customer?.id !== customerID.toString()) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Handle different HTTP methods (GET, PATCH, POST, DELETE)
    switch (req.method) {
      case 'GET': {
        response = customer;
        break;
      }

      case 'PATCH': {
        if (!req.body) {
          return createValidationErrorResponse('No customer data provided', 'body', null);
        }
        let bodyData: unknown;
        try {
          bodyData = JSON.parse(JSON.stringify(req.body));
        } catch (parseError) {
          return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
            parseError: parseError instanceof Error ? parseError.message : 'Malformed JSON',
          });
        }
        try {
          const validatedData = CustomerUpdateSchema.parse(bodyData);
          response = await services.protectedStripe.customers.update(
            customerID.toString(),
            validatedData as Stripe.CustomerUpdateParams,
          );
        } catch (validationError) {
          return createValidationErrorResponse('Invalid customer data', 'body', bodyData, {
            validationErrors:
              validationError instanceof Error ? validationError.message : String(validationError),
          });
        }
        break;
      }

      case 'POST': {
        if (!req.body) {
          return createValidationErrorResponse('No customer data provided', 'body', null);
        }
        let bodyData: unknown;
        try {
          bodyData = JSON.parse(JSON.stringify(req.body));
        } catch (parseError) {
          return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
            parseError: parseError instanceof Error ? parseError.message : 'Malformed JSON',
          });
        }
        try {
          const validatedData = CustomerCreateSchema.parse(bodyData);

          // GAP-132 B-3 — look-up-first guard.
          //
          // The canonical user-initiated checkout flow at
          // apps/api/src/routes/billing.ts:233 wraps customers.create in
          // ensureStripeCustomer, which uses a PostgreSQL advisory lock
          // (`pg_advisory_xact_lock`) on the customer-by-email key + a Stripe
          // idempotency-key header to serialize concurrent creations and
          // prevent duplicate Stripe customer rows for the same email.
          //
          // This admin proxy DOES NOT route through that critical section
          // (admin actions are intentionally god-mode, separate from the
          // user-initiated flow). The race window: an admin manually
          // creating a customer for email X while a user is mid-checkout
          // for email X simultaneously can produce two Stripe customer
          // records.
          //
          // Full atomic resolution (B-1: extract ensureStripeCustomer into
          // a shared module) is deferred to v0.4.x post-launch. For the
          // pre-Stripe-live posture, this look-up-first guard catches the
          // common case where a user-initiated checkout already created
          // the customer between admin actions: query Stripe for an
          // existing customer with the requested email; if exactly one
          // exists, reuse it instead of creating a duplicate.
          //
          // Limitations preserved (defer to B-1):
          // - No advisory lock: a concurrent admin-create + user-checkout
          //   for a never-seen email can still race. Probability low
          //   (admin actions are rare); blast radius bounded (one extra
          //   Stripe customer record, recoverable via manual merge).
          // - No Stripe idempotency-key: if THIS request retries (admin
          //   double-click), a non-idempotent create may run twice. The
          //   look-up-first check catches that on retry.
          if (validatedData.email) {
            const existing = await services.protectedStripe.customers.list({
              email: validatedData.email,
              limit: 2,
            });
            const onlyMatch = existing.data.length === 1 ? existing.data[0] : undefined;
            if (onlyMatch) {
              response = onlyMatch;
              if (logs) {
                req?.revealui?.logger?.info(
                  `customersProxy POST: reused existing Stripe customer for email ${validatedData.email} (look-up-first hit, GAP-132 B-3)`,
                );
              }
              break;
            }
            // 0 matches → fall through to create (new email)
            // 2+ matches → fall through to create + log a warning (admin
            // should reconcile manually); we don't pick one of N
            if (existing.data.length > 1) {
              req?.revealui?.logger?.warn(
                `customersProxy POST: multiple existing Stripe customers (${existing.data.length}) for email ${validatedData.email}; creating a new one. Admin should reconcile.`,
              );
            }
          }

          response = await services.protectedStripe.customers.create(
            validatedData as Stripe.CustomerCreateParams,
          );
        } catch (validationError) {
          return createValidationErrorResponse('Invalid customer data', 'body', bodyData, {
            validationErrors:
              validationError instanceof Error ? validationError.message : String(validationError),
          });
        }
        break;
      }

      case 'DELETE': {
        response = await services.protectedStripe.customers.del(customerID.toString());
        break;
      }

      default:
        return createApplicationErrorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405);
    }

    if (logs) req?.revealui?.logger?.info(`Stripe API response: ${JSON.stringify(response)}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return createErrorResponse(error, {
      endpoint: '/api/users/:id/customer',
      operation: 'customer_proxy',
      customerID,
    });
  }
};
