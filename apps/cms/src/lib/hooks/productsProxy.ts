/* eslint-disable prettier/prettier */
import type { PayloadHandler, PayloadRequest } from "@revealui/cms"
import { stripe } from "services"
// import Stripe from "stripe";
import { Role } from "@/lib/access/permissions/roles"
import { checkUserRoles } from "../access/users/checkUserRoles"

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
//   apiVersion: "2024-06-20",
// });

const logs = process.env.STRIPE_PROXY === "1"

// use this handler to get all Stripe products
// prevents unauthorized or non-admin users from accessing all Stripe products
// GET /api/products
export const productsProxy: PayloadHandler = async (
  req: PayloadRequest
): Promise<Response> => {
  if (
    !req.user ||
    !checkUserRoles(req.user, [Role.UserSuperAdmin, Role.UserAdmin])
  ) {
    if (logs)
      req.payload.logger.error({
        err: `You are not authorized to access products`,
      })
    return new Response("You are not authorized to access products", {
      status: 401,
    })
  }

  try {
    const products = await stripe.products.list({
      limit: 100,
    })

    return new Response(JSON.stringify(products), {
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error: unknown) {
    if (logs)
      req.payload.logger.error({ err: `Error using Stripe API: ${error}` })
    return new Response(`Error using Stripe API: ${error}`, {
      status: 500,
    })
  }
}
// import type { PayloadHandler, PayloadRequest } from 'payload'
// import Stripe from 'stripe'
// import { checkUser } from '../..'
// import { UserRole } from '../../access/checkUser'

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
//   apiVersion: '2024-06-20'
// })

// const logs = process.env.STRIPE_PROXY === '1'

// // use this handler to get all Stripe products
// // prevents unauthorized or non-admin users from accessing all Stripe products
// // GET /api/products
// export const productsProxy: PayloadHandler = async (
//   req: PayloadRequest
// ): Promise<Response> => {
//   if (
//     !req.user ||
//     !checkUser(['super-admin'], req.user as unknown as UserRole)
//   ) {
//     if (logs)
//       req.payload.logger.error({
//         err: `You are not authorized to access products`
//       })
//     return new Response('You are not authorized to access products', {
//       status: 401
//     })
//   }

//   try {
//     const products = await stripe.products.list({
//       limit: 100
//     })

//     return new Response(JSON.stringify(products), {
//       headers: {
//         'Content-Type': 'application/json'
//       }
//     })
//   } catch (error: unknown) {
//     if (logs)
//       req.payload.logger.error({ err: `Error using Stripe API: ${error}` })
//     return new Response(`Error using Stripe API: ${error}`, {
//       status: 500
//     })
//   }
// }
