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
