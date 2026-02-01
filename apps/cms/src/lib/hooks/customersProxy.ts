import type { RevealHandler, RevealRequest, RevealUser } from '@revealui/core'
import { protectedStripe } from 'services'
import type Stripe from 'stripe'
import { Role } from '@/lib/access/permissions/roles'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response-handler'
import { checkUserRoles } from '../access/users/checkUserRoles.js'
import { CustomerCreateSchema, CustomerUpdateSchema } from '../validation/stripe-schemas.js'

interface CustomUser extends RevealUser {
  stripeCustomerID?: string
}

const logs = process.env.STRIPE_PROXY === '1'

// Handler to get all Stripe customers
// GET /api/customers
export const customersProxy: RevealHandler = async (req: RevealRequest): Promise<Response> => {
  if (!(req.user && checkUserRoles(req.user, [Role.UserSuperAdmin]))) {
    return createApplicationErrorResponse(
      'You are not authorized to access customers',
      'UNAUTHORIZED',
      401,
    )
  }

  try {
    const customers = await protectedStripe.customers.list({ limit: 100 })
    return new Response(JSON.stringify(customers), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return createErrorResponse(error, {
      endpoint: '/api/customers',
      operation: 'list_customers',
    })
  }
}

// Handler to interact with a specific Stripe customer associated with a user
// GET /api/users/:id/customer
// POST /api/users/:id/customer
// PATCH /api/users/:id/customer
// DELETE /api/users/:id/customer
export const customerProxy: RevealHandler = async (req: RevealRequest) => {
  const userID = req.query?.id as string | undefined

  const user = req.user as CustomUser

  if (!user) {
    return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  if (!user.id) {
    return createApplicationErrorResponse(`No ID found for user ${userID}`, 'USER_NOT_FOUND', 404)
  }

  const customerID = user.stripeCustomerID || user.id

  try {
    let response:
      | Stripe.Customer
      | Stripe.DeletedCustomer
      | Stripe.ApiList<Stripe.Customer | Stripe.DeletedCustomer>

    const customer = await (
      protectedStripe.customers.retrieve as (
        id: string,
        params?: Stripe.CustomerRetrieveParams,
      ) => Promise<Stripe.Customer | Stripe.DeletedCustomer>
    )(customerID.toString(), {
      expand: ['invoice_settings.default_payment_method'],
    })

    if (customer?.deleted) {
      return createApplicationErrorResponse('Customer not found', 'CUSTOMER_NOT_FOUND', 404)
    }

    if (customer?.id !== customerID.toString()) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

    // Handle different HTTP methods (GET, PATCH, POST, DELETE)
    switch (req.method) {
      case 'GET': {
        response = customer
        break
      }

      case 'PATCH': {
        if (!req.body) {
          return createValidationErrorResponse('No customer data provided', 'body', null)
        }
        let bodyData: unknown
        try {
          bodyData = JSON.parse(JSON.stringify(req.body))
        } catch (parseError) {
          return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
            parseError: parseError instanceof Error ? parseError.message : 'Malformed JSON',
          })
        }
        try {
          const validatedData = CustomerUpdateSchema.parse(bodyData)
          response = await protectedStripe.customers.update(
            customerID.toString(),
            validatedData as Stripe.CustomerUpdateParams,
          )
        } catch (validationError) {
          return createValidationErrorResponse('Invalid customer data', 'body', bodyData, {
            validationErrors:
              validationError instanceof Error ? validationError.message : String(validationError),
          })
        }
        break
      }

      case 'POST': {
        if (!req.body) {
          return createValidationErrorResponse('No customer data provided', 'body', null)
        }
        let bodyData: unknown
        try {
          bodyData = JSON.parse(JSON.stringify(req.body))
        } catch (parseError) {
          return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
            parseError: parseError instanceof Error ? parseError.message : 'Malformed JSON',
          })
        }
        try {
          const validatedData = CustomerCreateSchema.parse(bodyData)
          response = await protectedStripe.customers.create(
            validatedData as Stripe.CustomerCreateParams,
          )
        } catch (validationError) {
          return createValidationErrorResponse('Invalid customer data', 'body', bodyData, {
            validationErrors:
              validationError instanceof Error ? validationError.message : String(validationError),
          })
        }
        break
      }

      case 'DELETE': {
        response = await protectedStripe.customers.del(customerID.toString())
        break
      }

      default:
        return createApplicationErrorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405)
    }

    if (logs) req?.revealui?.logger?.info(`Stripe API response: ${JSON.stringify(response)}`)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return createErrorResponse(error, {
      endpoint: '/api/users/:id/customer',
      operation: 'customer_proxy',
      customerID,
    })
  }
}
// /* eslint-disable @typescript-eslint/no-explicit-any */
// import type { RevealHandler, RevealRequest } from '@revealui/core'
// import Stripe from 'stripe'
// import { checkUser } from '../..'
// import { UserRole } from '../../access/checkUser'

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
//   apiVersion: '2024-06-20'
//)

// const logs = process.env.STRIPE_PROXY === '1'

// // use this handler to get all Stripe customers
// // prevents unauthorized or non-admin users from accessing all Stripe customers
// // GET /api/customers
// export const customersProxy: RevealHandler = async (
//   req: RevealRequest
// ): Promise<any> => {
//   if (
//     !req.user ||
//     !checkUser(['super-admin'], req.user as unknown as UserRole)
//   ) {
//     if (logs)
//       req?.revealui?.logger?.error(
//         err: `You are not authorized to access customers`
//      )
//     return { error: `You are not authorized to access customers` }
//   }

//   try {
//     const customers = await stripe.customers.list({
//       limit: 100
//    )

//     return customers
//   } catch (error: unknown) {
//     if (logs)
//       req?.revealui?.logger?.error(`Error using Stripe API: ${error}`)
//     return { error: `Error using Stripe API: ${error}` }
//   }
// }
