/* eslint-disable @typescript-eslint/no-explicit-any */
import { DEFAULT_COOKIE_OPTIONS } from "@supabase/ssr";
import type Stripe from "stripe";
import { createServerClient } from "../..";
import stripe from "../../stripe/stripeClient";
import {
  manageSubscriptionStatusChange,
  upsertPriceRecord,
  upsertProductRecord,
} from "../utils";

const relevantEvents = new Set([
  "product.created",
  "product.updated",
  "price.created",
  "price.updated",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: Request) {
  const supabase = createServerClient(DEFAULT_COOKIE_OPTIONS);

  console.log("request:", request);
  console.log("relevantEvents:", relevantEvents);

  const body = await request.text();
  const sig = request.headers.get("Stripe-Signature");

  const webhookSecret =
    import.meta.env.STRIPE_WEBHOOK_SECRET_LIVE ??
    import.meta.env.STRIPE_WEBHOOK_SECRET ??
    "";

  const event = stripe.webhooks.constructEvent(
    body,
    sig as string,
    webhookSecret,
  );
  const checkoutSession = event.data.object;
  try {
    if (!sig || !webhookSecret) return;
  } catch (err: any) {
    console.log(`❌ Error message: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case "product.created":
        case "product.updated":
          await upsertProductRecord(supabase, event.data.object);
          break;
        case "price.created":
        case "price.updated":
          await upsertPriceRecord(supabase, event.data.object);
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await manageSubscriptionStatusChange(
            subscription.id as string,
            subscription.customer as string,
            event.type === "customer.subscription.created",
            supabase,
          );
          break;
        }
        case "checkout.session.completed":
          if (checkoutSession.object === "subscription") {
            const subscriptionId = checkoutSession.id;
            await manageSubscriptionStatusChange(
              subscriptionId as string,
              checkoutSession.customer as string,
              true,
              supabase,
            );
            console.log("Subscription session completed!");
          }
          break;
        default:
          throw new Error("Unhandled relevant event!");
      }
    } catch (error) {
      console.log(error);

      return new Response(
        'Webhook error: "Webhook handler failed. View logs."',
        {
          status: 400,
        },
      );
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
