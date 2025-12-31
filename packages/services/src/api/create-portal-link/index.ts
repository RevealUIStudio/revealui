import { DEFAULT_COOKIE_OPTIONS } from "@supabase/ssr";
import { createServerClient } from "../..";
import stripe from "../../stripe/stripeClient";
import { createOrRetrieveCustomer, getURL } from "../utils";

export async function POST() {
  const supabase = createServerClient(DEFAULT_COOKIE_OPTIONS);
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw Error("Could not get user");
    const customer = await createOrRetrieveCustomer({
      uuid: user.id || "",
      email: user.email || "",
      supabase,
    });
    if (!customer) throw Error("Could not get customer");
    const { url } = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${getURL()}/account`,
    });
    return Response.json({ url });
  } catch (err) {
    console.log(err);
    // new NextResponse("Internal Error", { status: 500 });
    return new Response("Internal Error", { status: 500 });
  }
}
