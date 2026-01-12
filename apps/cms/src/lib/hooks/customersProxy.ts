import type { RevealHandler, RevealRequest, RevealUser } from '@revealui/core'
import { protectedStripe } from 'services'
import type Stripe from 'stripe'
import { Role } from '@/lib/access/permissions/roles'
import { checkUserRoles } from '../access/users/checkUserRoles'
import { CustomerCreateSchema, CustomerUpdateSchema } from '../validation/stripe-schemas'

interface CustomUser extends RevealUser {
  stripeCustomerID?: string
}

const logs = process.env.STRIPE_PROXY === '1'

// Handler to get all Stripe customers
// GET /api/customers
export const customersProxy: RevealHandler = async (req: RevealRequest): Promise<any> => {
  if (!req.user || !checkUserRoles(req.user, [Role.UserSuperAdmin])) {
    if (logs) req?.revealui?.logger?.error(`You are not authorized to access customers`)
    return { error: `You are not authorized to access customers` }
  }

  try {
    const customers = await protectedStripe.customers.list({ limit: 100 })
    return customers
  } catch (error: unknown) {
    if (logs) req?.revealui?.logger?.error(`Error using Stripe API: ${error}`)
    return { error: `Error using Stripe API: ${error}` }
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
    if (logs) req?.revealui?.logger?.error(`You are not authorized to access this customer`)
    return new Response('Unauthorized', { status: 401 })
  }

  if (!user.id) {
    const message = `No ID found for user ${userID}`
    if (logs) req?.revealui?.logger?.error(message)
    return new Response(message, { status: 404 })
  }

  try {
    let response:
      | Stripe.Customer
      | Stripe.DeletedCustomer
      | Stripe.ApiList<Stripe.Customer | Stripe.DeletedCustomer>

    const customerID = user.stripeCustomerID || user.id // Now stripeCustomerID is correctly typed

    const customer = await protectedStripe.customers.retrieve(customerID.toString(), {
      expand: ['invoice_settings.default_payment_method'],
    } as any)

    if (customer?.deleted) {
      return new Response('Customer not found', { status: 404 })
    }

    if (customer?.id !== customerID.toString()) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Handle different HTTP methods (GET, PATCH, POST, DELETE)
    switch (req.method) {
      case 'GET': {
        response = customer as Stripe.Customer
        break
      }

      case 'PATCH': {
        if (!req.body) throw new Error('No customer data provided')
        const bodyData = JSON.parse(req.body.toString())
        const validatedData = CustomerUpdateSchema.parse(bodyData)
        response = await protectedStripe.customers.update(
          customerID.toString(),
          validatedData as Stripe.CustomerUpdateParams,
        )
        break
      }

      case 'POST': {
        if (!req.body) throw new Error('No customer data provided')
        const bodyData = JSON.parse(req.body.toString())
        const validatedData = CustomerCreateSchema.parse(bodyData)
        response = await protectedStripe.customers.create(
          validatedData as Stripe.CustomerCreateParams,
        )
        break
      }

      case 'DELETE': {
        response = await protectedStripe.customers.del(customerID.toString())
        break
      }

      default:
        return new Response('Method Not Allowed', { status: 405 })
    }

    if (logs) req?.revealui?.logger?.info(`Stripe API response: ${JSON.stringify(response)}`)

    return new Response(JSON.stringify(response))
  } catch (error: unknown) {
    if (logs) req?.revealui?.logger?.error(`Error using Stripe API: ${error}`)
    return new Response('Error using Stripe API', { status: 500 })
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
