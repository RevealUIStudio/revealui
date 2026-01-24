import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RevealRequest, RevealUIInstance } from '@revealui/core'
import { logger } from '@revealui/core/utils/logger'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { protectedStripe } from '../stripe/stripeClient'
import { createServerClient } from '../supabase'
import type { Database, TablesInsert } from '../supabase/types'
import type { ExtendedStripeWebhookEvent, StripeWebhookEvent } from './types/stripe'
import { extractCustomerId, isStripePaymentMethod } from './types/stripe'

interface Context {
  req: IncomingMessage
  res: ServerResponse
}
export function createClient(context: Context): ReturnType<typeof createServerClient> {
  return createServerClient(context)
}

// export async function handleWebhook(req: IncomingMessage, res: ServerResponse) {
//   const context: Context = { req, res };
//   const supabase = createClient(context); // Create supabase client

//   // Call the function and pass the supabase client
//   await handleCustomerSubscriptionDeleted(event, supabase);
// }
// export async function handleRequest(req: IncomingMessage, res: ServerResponse) {
//   const context: Context = { req, res };

//   const supabase = createClient(context);
// }
export const getURL = (): string => {
  const filename = fileURLToPath(import.meta.url)
  const dirname = path.dirname(filename)
  let url = path.resolve(dirname)
  // Make sure to include `https://` when not localhost.
  url = url.includes('http') ? url : `https://${url}`
  // Make sure to include a trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`
  return url
}

export const upsertRecord = async (
  supabase: SupabaseClient<Database>,
  table: keyof Database['public']['Tables'],
  record: Record<string, unknown>,
): Promise<void> => {
  const { error } = await supabase.from(table).upsert([record as any])
  if (error) {
    logger.error('Error upserting record', { table: String(table), error })
    throw error
  }
  logger.info('Record upserted', { table: String(table), record })
}

// export const upsertRecord = async (
//   supabase: SupabaseClient<Database>,
//   table: keyof Database["public"]["Tables"],
//   record: Record<string, any>,
// ) => {
//   const { error } = await supabase.from(table).upsert([record]);
//   if (error) {
//     console.error(`Error upserting to ${table}:`, error);
//     throw error;
//   }
// };

export const toDateTime = (secs: number): Date => {
  const t = new Date(1970, 0, 1) // Unix epoch start.
  t.setSeconds(secs)
  return t
}

export const upsertProductRecord = async (
  supabase: SupabaseClient<Database>,
  product: Stripe.Product,
): Promise<void> => {
  // Ensure that the types match your database schema.
  const productData: TablesInsert<'products'> = {
    stripe_product_i_d: product.id,
    title: typeof product.name === 'string' ? product.name : (product.name as string),
    created_at: new Date(product.created * 1000).toISOString(), // Convert timestamp to ISO string
    updated_at: new Date(product.updated * 1000).toISOString(),
    price_j_s_o_n: product.default_price
      ? typeof product.default_price === 'string'
        ? product.default_price
        : typeof product.default_price === 'object' &&
            product.default_price !== null &&
            'id' in product.default_price
          ? String((product.default_price as { id: string }).id)
          : String(product.default_price)
      : null, // Handle optional fields properly
  }

  await upsertRecord(supabase, 'products', productData)
}

// export const upsertProductRecord = async (
//   supabase: SupabaseClient<Database>,
//   product: Stripe.Product,
// ) => {
//   const productData: TablesInsert<"products"> = {
//     stripe_product_i_d: product.id,
//     title: product.name,
//     created_at: product.created.toString(),
//     updated_at: product.updated.toString(),
//     price_j_s_o_n: product.default_price?.toString(),
//   };
//   await upsertRecord(supabase, "products", productData);
// };

export const upsertPriceRecord = async (
  supabase: SupabaseClient<Database>,
  price: Stripe.Price,
): Promise<void> => {
  const priceData: TablesInsert<'prices'> = {
    price_j_s_o_n: price.id.toString(), // Convert the price ID to string if necessary
    // product_id: typeof price.product === "string" ? price.product : "", // Make sure `product_id` is a string
    // currency: price.currency,
    // description: price.nickname ?? undefined,
    // unit_amount: price.unit_amount ?? undefined,
    // interval: price.recurring?.interval ?? null,
    // interval_count: price.recurring?.interval_count ?? null,
    // trial_period_days: price.recurring?.trial_period_days ?? null,
  }

  await upsertRecord(supabase, 'prices', priceData)
}

// export const upsertPriceRecord = async (
//   supabase: SupabaseClient<Database>,
//   price: Stripe.Price,
// ) => {
//   const priceData: TablesInsert<"products"> = {
//     price_j_s_o_n: price.toString(),

//     // id: price.id, // Ensure this is the correct type in the DB (string or number).
//     // product_id: typeof price.product === "string" ? price.product : "", // Ensure product_id matches the DB type.
//     // currency: price.currency,
//     // description: price.nickname ?? undefined,
//     // unit_amount: price.unit_amount ?? undefined,
//     // interval: price.recurring?.interval ?? null,
//     // interval_count: price.recurring?.interval_count ?? null,
//     // trial_period_days: price.recurring?.trial_period_days ?? null,
//   };

// Ensure correct table name and upsert operation.
//   await upsertRecord(supabase, "products", priceData);
// };
// export const upsertPriceRecord = async (
//   supabase: SupabaseClient<Database>,
//   price: Stripe.Price,
// ) => {
//   const priceData = {
//     id: price.id,
//     product_id: typeof price.product === "string" ? price.product : "",
//     currency: price.currency,
//     description: price.nickname ?? undefined,
//     unit_amount: price.unit_amount ?? undefined,
//     interval: price.recurring?.interval ?? null,
//     interval_count: price.recurring?.interval_count ?? null,
//     trial_period_days: price.recurring?.trial_period_days ?? null,
//   };

//   await upsertRecord(supabase, priceData, price);
// };

export const createOrRetrieveCustomer = async ({
  email,
  uuid,
  supabase,
}: {
  email: string
  uuid: string | number
  supabase: SupabaseClient<Database>
}): Promise<string | { stripe_customer_id: string | null }> => {
  const { data, error } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', String(uuid))
    .single()
  if (error || !data) {
    const customerData: Stripe.CustomerCreateParams = {
      metadata: {
        supabaseUUID: String(uuid),
        ...(email ? { email } : {}),
      },
    }
    const customer = await protectedStripe.customers.create(customerData)
    const { error: supabaseError } = await supabase.from('users').insert([
      {
        email: email,
        stripe_customer_id: customer.id,
        // id: uuid as string,
        // billing_address: customer.address,
        // created_at: customer.created,
        // name: customer.name as string,
      },
    ] as TablesInsert<'users'>[])
    if (supabaseError) throw supabaseError
    logger.info('New customer created and inserted', { uuid })
    return customer.id
  }
  return data
}

export const copyBillingDetailsToCustomer = async (
  uuid: string | number,
  paymentMethod: Stripe.PaymentMethod,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const customerId = extractCustomerId(paymentMethod.customer)
  if (!customerId) {
    throw new Error('Payment method does not have a valid customer ID')
  }

  const { name, phone, address } = paymentMethod.billing_details
  if (!name || !phone || !address) return

  const updateParams: Stripe.CustomerUpdateParams = {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(address
      ? {
          address: {
            city: address.city ?? undefined,
            country: address.country ?? undefined,
            line1: address.line1 ?? undefined,
            line2: address.line2 ?? undefined,
            postal_code: address.postal_code ?? undefined,
            state: address.state ?? undefined,
          },
        }
      : {}),
  }

  await protectedStripe.customers.update(customerId, updateParams)
  const { error } = await supabase
    .from('users')
    .update({
      // billing_address: { ...address },
      // payment_method: { ...payment_method[payment_method.type] },
    })
    .eq('id', String(uuid))
  if (error) throw error
}

export const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string | number,
  createAction = false,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  // Get customer's UUID from users table.
  const { data: customerData, error: noCustomerError } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', String(customerId))
    .single()
  if (noCustomerError) throw noCustomerError

  const { id: uuid } = customerData

  const subscription = await protectedStripe.subscriptions.retrieve(subscriptionId)
  // Upsert the latest status of the subscription object.
  const typedSubscription = subscription as Stripe.Subscription & {
    current_period_start: number
    current_period_end: number
  }
  const subscriptionData: Database['public']['Tables']['subscriptions']['Insert'] = {
    id: typedSubscription.id,
    user_id: uuid,
    metadata: typedSubscription.metadata,
    status: typedSubscription.status,
    price_id: typedSubscription.items.data[0]?.price?.id || null,
    stripe_subscription_id: typedSubscription.id,
  }

  const { error } = await supabase.from('subscriptions').upsert([subscriptionData])
  if (error) throw error
  logger.info('Inserted/updated subscription', {
    subscriptionId: typedSubscription.id,
    userId: uuid,
  })

  // For a new subscription copy the billing details to the customer object.
  // NOTE: This is a costly operation and should happen at the very end.
  // For a new subscription copy the billing details to the customer object.
  // NOTE: This is a costly operation and should happen at the very end.
  // Note: Would need to retrieve payment method to get full details
  // For now, skipping this step as it requires additional API call
  // TODO: Implement payment method retrieval and billing details update when needed
  if (createAction && typedSubscription.default_payment_method && uuid) {
    // Payment method update logic would go here
  }
}

export const handleSupabaseError = (error: Error): void => {
  logger.error('Supabase error', { error })
  // Similar error handling for Supabase
}

export const handleCheckoutSessionCompleted = async (
  event: StripeWebhookEvent<'checkout.session.completed'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const checkoutSession = event.data.object
  const subscriptionId =
    typeof checkoutSession.subscription === 'string'
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id
  const customerId = extractCustomerId(checkoutSession.customer)

  if (!subscriptionId || !customerId) {
    throw new Error('Checkout session missing subscription or customer')
  }

  try {
    await manageSubscriptionStatusChange(subscriptionId, customerId, true, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

export const handleInvoicePaymentSucceeded = async (
  event: StripeWebhookEvent<'invoice.payment_succeeded'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const invoice = event.data.object as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }
  const subscriptionId = invoice.subscription
    ? typeof invoice.subscription === 'string'
      ? invoice.subscription
      : (invoice.subscription?.id ?? null)
    : null
  const customerId = extractCustomerId(invoice.customer)

  if (!subscriptionId || !customerId) {
    throw new Error('Invoice missing subscription or customer')
  }

  try {
    await manageSubscriptionStatusChange(subscriptionId, customerId, false, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

// // Stripe webhook handlers
// export const handleCheckoutSessionCompleted = async (event: {
//   data: { object: { subscription: any; customer: any } };
// }) => {
//   const { subscription, customer } = event.data.object;
//   try {
//     await manageSubscriptionStatusChange(subscription, customer, true);
//   } catch (error: any) {
//     handleSupabaseError(error);
//   }
// };

// export const handleInvoicePaymentSucceeded = async (event: {
//   data: { object: { subscription: any; customer: any } };
// }) => {
//   const { subscription, customer } = event.data.object;
//   try {
//     await manageSubscriptionStatusChange(subscription, customer);
//   } catch (error: any) {
//     handleSupabaseError(error);
//   }
// };

export async function handleInvoicePaymentFailed(
  event: StripeWebhookEvent<'invoice.payment_failed'>,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }
  const subscriptionId = invoice.subscription
    ? typeof invoice.subscription === 'string'
      ? invoice.subscription
      : (invoice.subscription?.id ?? null)
    : null
  const customerId = extractCustomerId(invoice.customer)

  if (!subscriptionId || !customerId) {
    throw new Error('Invoice missing subscription or customer')
  }

  try {
    await manageSubscriptionStatusChange(subscriptionId, customerId, false, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

export const handleCustomerSubscriptionDeleted = async (
  event: StripeWebhookEvent<'customer.subscription.deleted'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const subscription = event.data.object
  const customerId = extractCustomerId(subscription.customer)

  if (!customerId) {
    throw new Error('Subscription missing customer')
  }

  try {
    await manageSubscriptionStatusChange(subscription.id, customerId, false, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

export const handleCustomerSubscriptionCreated = async (
  event: StripeWebhookEvent<'customer.subscription.created'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const subscription = event.data.object
  const customerId = extractCustomerId(subscription.customer)

  if (!customerId) {
    throw new Error('Subscription missing customer')
  }

  try {
    await manageSubscriptionStatusChange(subscription.id, customerId, true, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

export const handleCustomerSubscriptionUpdated = async (
  event: StripeWebhookEvent<'customer.subscription.updated'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const subscription = event.data.object
  const customerId = extractCustomerId(subscription.customer)

  if (!customerId) {
    throw new Error('Subscription missing customer')
  }

  try {
    await manageSubscriptionStatusChange(subscription.id, customerId, false, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

export const handleCustomerCreated = (event: StripeWebhookEvent<'customer.created'>): void => {
  const customer = event.data.object
  if (!customer.email || typeof customer.email !== 'string') {
    throw new Error('Customer missing email')
  }

  // Note: This function needs supabase client - may need to be updated
  // For now, throwing error to indicate missing implementation
  throw new Error('handleCustomerCreated requires supabase client parameter')
}

export const handleCustomerUpdated = (event: StripeWebhookEvent<'customer.updated'>): void => {
  const customer = event.data.object
  if (!customer.email || typeof customer.email !== 'string') {
    throw new Error('Customer missing email')
  }

  // Note: This function needs supabase client - may need to be updated
  // For now, throwing error to indicate missing implementation
  throw new Error('handleCustomerUpdated requires supabase client parameter')
}

export const handlePaymentMethodAttached = async (
  event: StripeWebhookEvent<'payment_method.attached'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const paymentMethod = event.data.object
  if (!isStripePaymentMethod(paymentMethod)) {
    throw new Error('Invalid payment method in event')
  }

  const customerId = extractCustomerId(paymentMethod.customer)
  if (!customerId) {
    throw new Error('Payment method missing customer')
  }

  // Get user UUID from customer ID - this needs proper implementation
  // For now, we'll need to look up the user by stripe_customer_id
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!userData) {
    throw new Error('User not found for customer')
  }

  // Type assertion needed due to Supabase type inference issue
  const userId = (userData as { id: string }).id
  if (!userId) {
    throw new Error('User missing id')
  }

  try {
    await copyBillingDetailsToCustomer(userId, paymentMethod, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

export const handlePaymentMethodDetached = async (
  event: StripeWebhookEvent<'payment_method.detached'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const paymentMethod = event.data.object
  if (!isStripePaymentMethod(paymentMethod)) {
    throw new Error('Invalid payment method in event')
  }

  const customerId = extractCustomerId(paymentMethod.customer)
  if (!customerId) {
    throw new Error('Payment method missing customer')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!userData) {
    throw new Error('User not found for customer')
  }

  // Type assertion needed due to Supabase type inference issue
  const userId = (userData as { id: string }).id
  if (!userId) {
    throw new Error('User missing id')
  }

  try {
    await copyBillingDetailsToCustomer(userId, paymentMethod, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

export const handlePaymentMethodCreated = async (
  event: ExtendedStripeWebhookEvent<'payment_method.created'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const paymentMethod = event.data.object
  if (!isStripePaymentMethod(paymentMethod)) {
    throw new Error('Invalid payment method in event')
  }

  const customerId = extractCustomerId(paymentMethod.customer)
  if (!customerId) {
    throw new Error('Payment method missing customer')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!userData) {
    throw new Error('User not found for customer')
  }

  // Type assertion needed due to Supabase type inference issue
  const userId = (userData as { id: string }).id
  if (!userId) {
    throw new Error('User missing id')
  }

  try {
    await copyBillingDetailsToCustomer(userId, paymentMethod, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

export const handlePaymentMethodUpdated = async (
  event: StripeWebhookEvent<'payment_method.updated'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const paymentMethod = event.data.object
  if (!isStripePaymentMethod(paymentMethod)) {
    throw new Error('Invalid payment method in event')
  }

  const customerId = extractCustomerId(paymentMethod.customer)
  if (!customerId) {
    throw new Error('Payment method missing customer')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!userData) {
    throw new Error('User not found for customer')
  }

  // Type assertion needed due to Supabase type inference issue
  const userId = (userData as { id: string }).id
  if (!userId) {
    throw new Error('User missing id')
  }

  try {
    await copyBillingDetailsToCustomer(userId, paymentMethod, supabase)
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error)
    } else {
      handleSupabaseError(new Error(String(error)))
    }
  }
}

export const handleSetupIntentSucceeded = (
  event: ExtendedStripeWebhookEvent<'setup_intent.succeeded'>,
  _supabase: SupabaseClient<Database>,
): void => {
  // Suppress unused parameter warning - may be used in future implementation
  void _supabase
  const setupIntent = event.data.object as Stripe.SetupIntent
  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id

  if (!paymentMethodId) {
    throw new Error('Setup intent missing payment method')
  }

  // Retrieve payment method to get customer info
  // Note: This requires accessing payment methods API which may not be in protectedStripe
  // For now, we'll skip updating billing details on setup intent success
  // as it's typically done when the payment method is actually used
  logger.info('Setup intent succeeded', {
    setupIntentId: setupIntent.id,
    paymentMethodId,
  })
}

export const handleSetupIntentFailed = (
  event: ExtendedStripeWebhookEvent<'setup_intent.failed'>,
  _supabase: SupabaseClient<Database>,
): void => {
  // Suppress unused parameter warning - may be used in future implementation
  void _supabase
  // Setup intent failed - typically we don't update billing details on failure
  // Log the error for monitoring
  const setupIntent = event.data.object as Stripe.SetupIntent
  logger.error('Setup intent failed', {
    setupIntentId: setupIntent.id,
    error: setupIntent.last_setup_error,
  })
}

interface CartItem {
  product: {
    stripeProductID: string
  }
  quantity: number
}

interface UserWithCart {
  stripeCustomerID?: string
  name?: string
  cart?: {
    items: CartItem[]
  }
}

interface CreatePaymentIntentArgs {
  req: RevealRequest
  res?: Response
  next?: () => void
  revealui?: RevealUIInstance
}

export const createPaymentIntent = async (
  args: CreatePaymentIntentArgs,
): Promise<
  | Response
  | {
      status: number
      json?: { error: string }
      send?: { client_secret: string | null }
    }
> => {
  const { req } = args
  const { user, revealui } = req

  if (!user || typeof user.email !== 'string') {
    return { status: 401, json: { error: 'Unauthorized' } }
  }

  if (!revealui) {
    return { status: 500, json: { error: 'RevealUI instance not available' } }
  }

  const fullUser = await revealui.findByID({
    collection: 'users',
    id: user.id,
  })

  if (!fullUser || typeof fullUser !== 'object') {
    return { status: 404, json: { error: 'User not found' } }
  }

  const typedUser = fullUser as UserWithCart

  try {
    let stripeCustomerID: string | undefined = typedUser.stripeCustomerID

    // Lookup user in Stripe and create one if not found
    if (!stripeCustomerID) {
      const customerParams: Stripe.CustomerCreateParams = {
        email: user.email,
        name: typeof typedUser.name === 'string' ? typedUser.name : undefined,
      }

      const customer = await protectedStripe.customers.create(customerParams)
      stripeCustomerID = customer.id

      await revealui.update({
        collection: 'users',
        id: user.id,
        data: {
          stripeCustomerID,
        },
      })
    }

    let total = 0
    const cart = typedUser.cart

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return { status: 400, json: { error: 'No items in cart' } }
    }

    // For each item in cart, lookup the product in Stripe and add its price to the total
    await Promise.allSettled(
      cart.items.map(async (item: CartItem): Promise<void> => {
        const { product, quantity } = item

        if (
          !quantity ||
          typeof product !== 'object' ||
          typeof product.stripeProductID !== 'string'
        ) {
          throw new Error('Invalid product or quantity')
        }

        const prices = await protectedStripe.prices.list({
          product: product.stripeProductID,
          limit: 100,
        })

        if (prices.data.length === 0) {
          throw new Error('No prices found for product')
        }

        const price = prices.data[0]
        if (price && price.unit_amount !== null && typeof price.unit_amount === 'number') {
          total += price.unit_amount * quantity
        }
      }),
    )

    if (total === 0) {
      throw new Error('There is nothing to pay for, add some items to your cart and try again.')
    }

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      customer: stripeCustomerID,
      amount: total,
      currency: 'usd',
      payment_method_types: ['card'],
    }

    const paymentIntent = await protectedStripe.paymentIntents.create(paymentIntentParams)

    return {
      status: 200,
      send: { client_secret: paymentIntent.client_secret },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const revealuiInstance = revealui
    if (revealuiInstance?.logger) {
      revealuiInstance.logger.error(message)
    }
    return { status: 500, json: { error: message } }
  }
}

interface CreateStripeCustomerParams {
  req: RevealRequest
  data: {
    email?: string
    stripeCustomerID?: string
    [key: string]: unknown
  }
  operation: string
}

export const createStripeCustomer = async ({
  req,
  data,
  operation,
}: CreateStripeCustomerParams): Promise<typeof data> => {
  const revealuiInstance = req.revealui
  if (operation === 'create' && !data.stripeCustomerID && typeof data.email === 'string') {
    try {
      // lookup an existing customer by email and if found, assign the ID to the user
      // if not found, create a new customer and assign the new ID to the user
      const existingCustomer = await protectedStripe.customers.list({
        email: data.email,
        limit: 1,
      })

      if (existingCustomer.data.length > 0 && existingCustomer.data[0]) {
        // existing customer found, assign the ID to the user
        return {
          ...data,
          stripeCustomerID: existingCustomer.data[0].id,
        }
      }

      // create a new customer and assign the ID to the user
      const customer = await protectedStripe.customers.create({
        email: data.email,
      })

      return {
        ...data,
        stripeCustomerID: customer.id,
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (revealuiInstance?.logger) {
        revealuiInstance.logger.error(`Error creating Stripe customer: ${errorMessage}`)
      } else {
        logger.error('Error creating Stripe customer', { error: errorMessage })
      }
    }
  }

  return data
}
