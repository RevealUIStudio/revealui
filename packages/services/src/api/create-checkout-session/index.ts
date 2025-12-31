import { DEFAULT_COOKIE_OPTIONS } from "@supabase/ssr";
import { createServerClient } from "../..";
import stripe from "../../stripe/stripeClient";
import { createOrRetrieveCustomer, getURL } from "../utils";

export async function POST(request: Request) {
  console.log("request:", request);
  const { price, quantity = 1, metadata = {} } = await request.json();
  const supabase = createServerClient(DEFAULT_COOKIE_OPTIONS);
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("user", user);
    const customer = await createOrRetrieveCustomer({
      uuid: user?.id || "",
      email: user?.email || "",
      supabase,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      billing_address_collection: "required",
      customer,
      line_items: [
        {
          price: price.id,
          quantity,
        },
      ],
      mode: "subscription",
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 7,
        metadata,
      },
      success_url: `${getURL()}/account`,
      cancel_url: `${getURL()}/`,
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.log(err);
    return new Response("Internal Error", { status: 500 });
  }
}
