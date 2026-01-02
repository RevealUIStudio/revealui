/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import type { RevealHandler, RevealRequest } from "@revealui/cms";
import type Stripe from "stripe";
import { fileURLToPath } from "url";
import { stripe } from "../index";
import { createServerClient } from "../supabase";
import { Database, TablesInsert } from "../supabase/types";

interface Context {
  req: IncomingMessage;
  res: ServerResponse;
}
export function createClient(context: Context) {
  return createServerClient(context);
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
export const getURL = () => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  let url = path.resolve(dirname);
  // Make sure to include `https://` when not localhost.
  url = url.includes("http") ? url : `https://${url}`;
  // Make sure to include a trailing `/`.
  url = url.charAt(url.length - 1) === "/" ? url : `${url}/`;
  return url;
};

export const upsertRecord = async (
  supabase: SupabaseClient<Database>,
  table: keyof Database["public"]["Tables"],
  record: Record<string, any>,
) => {
  const { error } = await supabase.from(table).upsert([record]);
  if (error) {
    console.error(`Error upserting to ${String(table)}:`, error);
    throw error;
  }
  console.log(`Record upserted to ${String(table)}:`, record);
};

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
//   console.log(`Record upserted to ${table}:`, record);
// };

export const toDateTime = (secs: number): Date => {
  const t = new Date(1970, 0, 1); // Unix epoch start.
  t.setSeconds(secs);
  return t;
};

export const upsertProductRecord = async (
  supabase: SupabaseClient<Database>,
  product: Stripe.Product,
) => {
  // Ensure that the types match your database schema.
  const productData: TablesInsert<"products"> = {
    stripe_product_i_d: product.id,
    title:
      typeof product.name === "string"
        ? product.name
        : (product.name as string),
    created_at: new Date(product.created * 1000).toISOString(), // Convert timestamp to ISO string
    updated_at: new Date(product.updated * 1000).toISOString(),
    price_j_s_o_n: product.default_price
      ? product.default_price.toString()
      : null, // Handle optional fields properly
  };

  await upsertRecord(supabase, "products", productData);
};

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
) => {
  const priceData: TablesInsert<"prices"> = {
    price_j_s_o_n: price.id.toString(), // Convert the price ID to string if necessary
    // product_id: typeof price.product === "string" ? price.product : "", // Make sure `product_id` is a string
    // currency: price.currency,
    // description: price.nickname ?? undefined,
    // unit_amount: price.unit_amount ?? undefined,
    // interval: price.recurring?.interval ?? null,
    // interval_count: price.recurring?.interval_count ?? null,
    // trial_period_days: price.recurring?.trial_period_days ?? null,
  };

  await upsertRecord(supabase, "prices", priceData);
};

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
  email: string;
  uuid: string | number;
  supabase: SupabaseClient<Database>;
}) => {
  const { data, error } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", uuid)
    .single();
  if (error || !data) {
    const customerData: {
      metadata: { supabaseUUID: string | number; email?: string };
    } = {
      metadata: {
        supabaseUUID: uuid,
        email,
      },
    };
    if (email) customerData.metadata.email = email;
    const customer = await stripe.customers.create(customerData);
    const { error: supabaseError } = await supabase.from("users").insert([
      {
        email: email,
        // id: uuid as string,
        // billing_address: customer.address,
        // created_at: customer.created,
        // email: customer.email as string,
        // stripe_customer_id: customer.id as string,
        // name: customer.name as string,
      },
    ]);
    if (supabaseError) throw supabaseError;
    console.log(`New customer created and inserted for ${uuid}.`);
    return customer.id;
  }
  return data;
};

export const copyBillingDetailsToCustomer = async (
  uuid: string | number,
  payment_method: Stripe.PaymentMethod,
  supabase: SupabaseClient<Database>,
) => {
  //Todo: check this assertion
  const customer = payment_method.customer;
  const { name, phone, address } = payment_method.billing_details;
  if (!name || !phone || !address) return;

  await stripe.customers.update(
    customer as any,
    { name, phone, address } as any,
  );
  const { error } = await supabase
    .from("users")
    .update({
      // billing_address: { ...address },
      // payment_method: { ...payment_method[payment_method.type] },
    })
    .eq("id", uuid);
  if (error) throw error;
};

export const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string | number,
  createAction = false,
  supabase: SupabaseClient<Database>,
) => {
  // Get customer's UUID from mapping table.
  const { data: customerData, error: noCustomerError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();
  if (noCustomerError) throw noCustomerError;

  const { id: uuid } = customerData;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method"],
  });
  // Upsert the latest status of the subscription object.
  // const subscriptionData: Database["public"]["Tables"]["subscriptions"]["Insert"] =
  //   {
  const subscriptionData: Database["public"]["Tables"]["subscriptions"]["Insert"] =
    {
      id: subscription.id,
      // name: subscription.customer,
      // user_id: uuid,
      metadata: subscription.metadata,
      // status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      quantity: subscription.items.data[0].quantity,
      // cancel_at_period_end: subscription.cancel_at_period_end,
      cancel_at: subscription.cancel_at
        ? toDateTime(subscription.cancel_at).toISOString()
        : null,
      canceled_at: subscription.canceled_at
        ? toDateTime(subscription.canceled_at).toISOString()
        : null,
      current_period_start: toDateTime(
        subscription.current_period_start,
      ).toISOString(),
      current_period_end: toDateTime(
        subscription.current_period_end,
      ).toISOString(),
      created_at: toDateTime(subscription.created).toISOString(),
      // ended_at: subscription.ended_at
      //   ? toDateTime(subscription.ended_at).toISOString()
      //   : null,
      trial_start: subscription.trial_start
        ? toDateTime(subscription.trial_start).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? toDateTime(subscription.trial_end).toISOString()
        : null,
      status: "active",
      user_id_id: 0,
    };

  const { error } = await supabase
    .from("subscriptions")
    .upsert([subscriptionData]);
  if (error) throw error;
  console.log(
    `Inserted/updated subscription [${subscription.id}] for user [${uuid}]`,
  );

  // For a new subscription copy the billing details to the customer object.
  // NOTE: This is a costly operation and should happen at the very end.
  if (createAction && subscription.default_payment_method && uuid)
    await copyBillingDetailsToCustomer(
      uuid,
      subscription.default_payment_method as Stripe.PaymentMethod,
      supabase,
    );
};

export const handleSupabaseError = (error: Error) => {
  console.error("Supabase error:", error);
  // Similar error handling for Supabase
};

export const handleCheckoutSessionCompleted = async (
  event: {
    data: { object: { subscription: any; customer: any } };
  },
  supabase: SupabaseClient<Database>,
) => {
  // Include supabase here
  const { subscription, customer } = event.data.object;
  try {
    await manageSubscriptionStatusChange(
      subscription,
      customer,
      true,
      supabase,
    ); // Pass supabase here
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handleInvoicePaymentSucceeded = async (
  event: {
    data: { object: { subscription: any; customer: any } };
  },
  supabase: SupabaseClient<Database>,
) => {
  // Include supabase here
  const { subscription, customer } = event.data.object;
  try {
    await manageSubscriptionStatusChange(
      subscription,
      customer,
      false,
      supabase,
    ); // Pass supabase here
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

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
  event: { data: { object: { subscription: any; customer: any } } },
  supabase: SupabaseClient<Database>, // Pass supabase client
) {
  const { subscription, customer } = event.data.object;

  try {
    await manageSubscriptionStatusChange(
      subscription, // subscription ID
      customer, // customer ID
      false, // createAction is false in this case
      supabase, // pass the supabase client correctly
    );
  } catch (error: any) {
    handleSupabaseError(error);
  }
}

export const handleCustomerSubscriptionDeleted = async (
  event: { data: { object: { subscription: any; customer: any } } },
  supabase: SupabaseClient<Database>, // Pass supabase client
) => {
  const { subscription, customer } = event.data.object;
  try {
    // Pass the correct number of arguments
    await manageSubscriptionStatusChange(
      subscription,
      customer,
      false,
      supabase,
    );
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handleCustomerSubscriptionCreated = async (
  event: { data: { object: { subscription: any; customer: any } } },
  supabase: SupabaseClient<Database>, // Supabase client passed as argument
) => {
  const { subscription, customer } = event.data.object;
  try {
    // Pass the supabase client along with other arguments
    await manageSubscriptionStatusChange(
      subscription,
      customer,
      true,
      supabase,
    );
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handleCustomerSubscriptionUpdated = async (
  event: { data: { object: { subscription: any; customer: any } } },
  supabase: SupabaseClient<Database>, // Ensure you pass the supabase client
) => {
  const { subscription, customer } = event.data.object;
  try {
    // Pass the subscription, customer, `createAction` (set to false), and supabase client
    await manageSubscriptionStatusChange(
      subscription,
      customer,
      false,
      supabase,
    );
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handleCustomerCreated = async (event: {
  data: { object: { customer: any } };
}) => {
  const { customer } = event.data.object;
  try {
    await createOrRetrieveCustomer(customer);
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handleCustomerUpdated = async (event: {
  data: { object: { customer: any } };
}) => {
  const { customer } = event.data.object;
  try {
    await createOrRetrieveCustomer(customer);
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handlePaymentMethodAttached = async (
  event: { data: { object: { customer: any; payment_method: any } } },
  supabase: SupabaseClient<Database>, // Ensure the supabase client is passed
) => {
  const { customer, payment_method } = event.data.object;
  try {
    // Pass the customer, payment method, and supabase client
    await copyBillingDetailsToCustomer(customer, payment_method, supabase);
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handlePaymentMethodDetached = async (
  event: {
    data: { object: { customer: any; payment_method: any } };
  },
  supabase: SupabaseClient<Database>,
) => {
  const { customer, payment_method } = event.data.object;
  try {
    await copyBillingDetailsToCustomer(customer, payment_method, supabase);
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handlePaymentMethodCreated = async (
  event: {
    data: { object: { customer: any; payment_method: any } };
  },
  supabase: SupabaseClient<Database>,
) => {
  const { customer, payment_method } = event.data.object;
  try {
    await copyBillingDetailsToCustomer(customer, payment_method, supabase);
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handlePaymentMethodUpdated = async (
  event: {
    data: { object: { customer: any; payment_method: any } };
  },
  supabase: SupabaseClient<Database>,
) => {
  const { customer, payment_method } = event.data.object;
  try {
    await copyBillingDetailsToCustomer(customer, payment_method, supabase);
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handleSetupIntentSucceeded = async (
  event: {
    data: { object: { customer: any; payment_method: any } };
  },
  supabase: SupabaseClient<Database>,
) => {
  const { customer, payment_method } = event.data.object;
  try {
    await copyBillingDetailsToCustomer(customer, payment_method, supabase);
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const handleSetupIntentFailed = async (
  event: {
    data: { object: { customer: any; payment_method: any } };
  },
  supabase: SupabaseClient<Database>,
) => {
  const { customer, payment_method } = event.data.object;
  try {
    await copyBillingDetailsToCustomer(customer, payment_method, supabase);
  } catch (error: any) {
    handleSupabaseError(error);
  }
};

export const createPaymentIntent: RevealHandler = async (
  req: RevealRequest,
): Promise<any> => {
  const { user, revealui } = req;

  if (!user || typeof user.email !== "string") {
    return { status: 401, json: { error: "Unauthorized" } };
  }

  const fullUser = await revealui.findByID({
    collection: "users",
    id: user.id,
  });

  if (!fullUser || typeof fullUser !== "object") {
    return { status: 404, json: { error: "User not found" } };
  }

  try {
    let stripeCustomerID: string | undefined = (fullUser as any)
      .stripeCustomerID;

    // Lookup user in Stripe and create one if not found
    if (!stripeCustomerID) {
      const customerParams: Stripe.CustomerCreateParams = {
        email: user.email,
        name: (fullUser as any)?.name || undefined, // Ensure fullUser.name is a string or undefined
      };

      const customer = await stripe.customers.create(customerParams);
      stripeCustomerID = customer.id;

      await revealui.update({
        collection: "users",
        id: user.id,
        data: {
          stripeCustomerID,
        },
      });
    }

    let total = 0;
    const cart = (fullUser as any).cart;

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return { status: 400, json: { error: "No items in cart" } };
    }

    // For each item in cart, lookup the product in Stripe and add its price to the total
    await Promise.allSettled(
      cart.items.map(
        async (item: { product: any; quantity: any }): Promise<any> => {
          const { product, quantity } = item;

          if (
            !quantity ||
            typeof product !== "object" ||
            !product.stripeProductID
          ) {
            throw new Error("Invalid product or quantity");
          }

          const prices = await stripe.prices.list({
            product: product.stripeProductID,
            limit: 100,
            expand: ["data.product"],
          });

          if (prices.data.length === 0) {
            return {
              status: 404,
              json: { error: "No prices found for product" },
            };
          }

          const price = prices.data[0];
          if (price.unit_amount !== null) {
            total += price.unit_amount * quantity;
          }

          return null;
        },
      ),
    );

    if (total === 0) {
      throw new Error(
        "There is nothing to pay for, add some items to your cart and try again.",
      );
    }

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      customer: stripeCustomerID,
      amount: total,
      currency: "usd",
      payment_method_types: ["card"],
    };

    const paymentIntent =
      await stripe.paymentIntents.create(paymentIntentParams);

    return { send: { client_secret: paymentIntent.client_secret } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    revealui.logger.error(message);
    return { status: 500, json: { error: message } };
  }
};

export const createStripeCustomer = async ({
  req,
  data,
  operation,
}: {
  req: any;
  data: any;
  operation: any;
}) => {
  if (operation === "create" && !data.stripeCustomerID) {
    try {
      // lookup an existing customer by email and if found, assign the ID to the user
      // if not found, create a new customer and assign the new ID to the user
      const existingCustomer = await stripe.customers.list({
        limit: 1,
        email: data.email,
      });

      if (existingCustomer.data.length) {
        // existing customer found, assign the ID to the user
        return {
          ...data,
          stripeCustomerID: existingCustomer.data[0].id,
        };
      }

      // create a new customer and assign the ID to the user
      const customer = await stripe.customers.create({
        email: data.email,
      });

      return {
        ...data,
        stripeCustomerID: customer.id,
      };
    } catch (error: unknown) {
      req.revealui.logger.error(`Error creating Stripe customer: ${error}`);
    }
  }

  return data;
};
