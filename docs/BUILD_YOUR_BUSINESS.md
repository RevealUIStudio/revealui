---
title: "Build Your First Business"
description: "Step-by-step tutorial for building a SaaS product with RevealUI"
category: tutorial
audience: developer
---

# Build Your First Business with RevealUI

This tutorial walks you from zero to a deployed SaaS product in under an hour. You'll build a simple product catalog with user accounts, billing, and an admin dashboard — the same foundation you'd use for any software business.

**What you'll build:** A product catalog where users can sign up, browse products, and purchase a Pro subscription.

**Time:** ~45 minutes

**Prerequisites:**

- Node.js 24+
- pnpm 10+
- A [NeonDB](https://neon.tech) account (free tier)
- A [Stripe](https://stripe.com) account (test mode)

---

## 1. Scaffold your project

```bash
npx create-revealui my-business
cd my-business
pnpm install
```

Copy the environment template and fill in your credentials:

```bash
cp .env.template .env.development.local
```

**Required variables:**

```env
POSTGRES_URL=postgresql://user:password@ep-xxx.neon.tech/mydb?sslmode=require
REVEALUI_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Initialize your database and start the dev server:

```bash
pnpm db:migrate
pnpm dev
```

Open [http://localhost:4000/admin](http://localhost:4000/admin). Create your admin account.

You now have: user auth, a REST API, and an admin dashboard.

---

## 2. Define your first collection

Collections are your business data. You define them in TypeScript; RevealUI generates the API, admin UI, and TypeScript types.

Create `apps/cms/src/collections/products.ts`:

```typescript
import { defineCollection, defineField } from "@revealui/core";

export const Products = defineCollection({
  slug: "products",
  labels: {
    singular: "Product",
    plural: "Products",
  },
  fields: [
    defineField({
      name: "name",
      type: "text",
      required: true,
    }),
    defineField({
      name: "description",
      type: "richText",
    }),
    defineField({
      name: "price",
      type: "number",
      required: true,
    }),
    defineField({
      name: "status",
      type: "select",
      options: ["draft", "active", "archived"],
      defaultValue: "draft",
    }),
  ],
  access: {
    // Anyone can read active products
    read: ({ req, data }) =>
      data?.status === "active" || req.user?.role === "admin",
    // Only admins can create/update/delete
    create: ({ req }) => req.user?.role === "admin",
    update: ({ req }) => req.user?.role === "admin",
    delete: ({ req }) => req.user?.role === "admin",
  },
});
```

Register it in your CMS config (`apps/cms/src/collections/index.ts`):

```typescript
export { Products } from "./products.js";
```

Now visit [http://localhost:4000/admin/products](http://localhost:4000/admin/products). You have a full CRUD interface for products — no additional code needed.

The REST API is live at:

```bash
GET  /api/products          # list (paginated)
GET  /api/products/:id      # single product
POST /api/products          # create (admin only)
PUT  /api/products/:id      # update (admin only)
DELETE /api/products/:id    # delete (admin only)
```

---

## 3. Seed some products

Create a few products through the admin UI, or seed them from code:

```bash
# Create a quick seed script
cat > scripts/seed-products.ts << 'EOF'
import { db } from '@revealui/db'
import { collections } from '@revealui/db/schema'

const products = [
  { name: 'Starter', price: 0, status: 'active', description: 'Get started for free.' },
  { name: 'Pro', price: 29, status: 'active', description: 'Everything you need to grow.' },
  { name: 'Forge', price: 299, status: 'active', description: 'For serious teams.' },
]

for (const product of products) {
  await db.insert(collections.products).values(product)
}

console.log('Seeded', products.length, 'products')
EOF

tsx scripts/seed-products.ts
```

---

## 4. Add a pricing page

RevealUI ships 58 UI components. Use them to build a pricing page in your frontend app.

In `apps/mainframe/src/pages/pricing.tsx`:

```tsx
import { Card, Badge, Button } from "@revealui/presentation";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

export async function PricingPage() {
  const res = await fetch("/api/products?status=active");
  const { docs: products }: { docs: Product[] } = await res.json();

  return (
    <div className="mx-auto max-w-5xl px-6 py-24">
      <h1 className="text-center text-4xl font-bold">Simple, honest pricing</h1>
      <p className="mt-4 text-center text-gray-600">
        Start free. Upgrade when you're ready.
      </p>

      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="p-8">
            <h2 className="text-xl font-bold">{product.name}</h2>
            <p className="mt-2 text-gray-600">{product.description}</p>
            <p className="mt-6 text-4xl font-bold">
              ${product.price}
              <span className="text-base font-normal text-gray-500">/mo</span>
            </p>
            <Button
              className="mt-8 w-full"
              href={`/checkout?product=${product.id}`}
            >
              {product.price === 0
                ? "Get started free"
                : `Upgrade to ${product.name}`}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## 5. Wire up billing

RevealUI's billing is pre-wired to Stripe. When a user clicks "Upgrade," they go through Stripe Checkout and come back with an active subscription.

The billing API is already live:

```bash
# Start a checkout session
POST /api/billing/checkout
{ "priceId": "price_xxx" }

# View the billing portal
POST /api/billing/portal

# Check subscription status
GET /api/billing/subscription
```

Add a checkout button to your pricing page:

```tsx
async function handleUpgrade(product: Product) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Pass the Stripe price ID you created in the Stripe dashboard
    body: JSON.stringify({ priceId: product.stripePriceId }),
  });
  const { url } = await res.json();
  window.location.href = url;
}
```

**Create a Stripe product and price:**

1. Open [dashboard.stripe.com/products](https://dashboard.stripe.com/products)
2. Create a product → Add a recurring price (e.g. $29/month)
3. Copy the **Price ID** (starts with `price_`)
4. Add it as `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` in your environment

**Test the checkout flow:**

```bash
# In a second terminal, forward webhooks to your local server
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

Click "Upgrade to Pro" on your pricing page. Use Stripe test card `4242 4242 4242 4242`. After checkout, the user's license is created in your database automatically.

### Strategic note for 2027+

The launch-month implementation shown above is intentionally simple: Stripe Checkout plus an app-side license record. That is enough to ship, but it should not be your long-term commercial model if you're building for agent-first internet workflows.

RevealUI's target pricing and billing strategy from 2027-2030 is:

- bill the `account` or `workspace` as the primary customer, not individual humans
- include a baseline subscription with predictable monthly or annual pricing
- meter agent execution separately using business-readable units like `agent_task`, `workflow_run`, `tool_call`, and `paid_api_call`
- charge explicit commerce fees for agent-completed orders or paid API invocations rather than hiding them inside seat pricing
- sell trust, governance, approvals, audit retention, and compliance as a separate premium layer

In practice, that means you should treat the example `priceId`-based flow in this tutorial as a launch path, not the final architecture. The durable model is:

`session -> membership -> account/workspace -> subscription -> entitlements -> meters`

That model is a better fit for agentic commerce than classic per-seat SaaS because agents will increasingly represent the customer's economic activity directly.

---

## 6. Gate features behind a subscription

Check the user's subscription in any route or component:

```typescript
import { getLicense } from '@revealui/auth/server'

// In a route handler
export async function GET(req: Request) {
  const license = await getLicense(req)

  if (!license || license.tier !== 'pro') {
    return Response.json({ error: 'Pro subscription required' }, { status: 403 })
  }

  // Pro-only content here
  return Response.json({ features: [...] })
}
```

Or in React:

```tsx
import { useSubscription } from "@revealui/auth/client";

function ProFeature() {
  const { tier, isLoading } = useSubscription();

  if (isLoading) return null;
  if (tier !== "pro") return <UpgradePrompt />;

  return <div>Pro-only content</div>;
}
```

---

## 7. Deploy

Push to GitHub. Connect to Vercel.

```bash
git add .
git commit -m "feat: initial product catalog with billing"
git push origin main
```

On [vercel.com](https://vercel.com):

1. **Import** your repository
2. Set the **Root Directory** to `apps/cms` (for the CMS/admin app)
3. Add your **environment variables** (same as `.env.development.local`, with production values)
4. Click **Deploy**

Your API deploys separately:

1. Import the same repo again → Root Directory: `apps/api`
2. Add env vars
3. Deploy

Update your `CORS_ORIGIN` in the API project to point at your CMS domain, and `NEXT_PUBLIC_API_URL` in the CMS project to point at your API domain.

```bash
# Verify production health
curl https://your-api.vercel.app/health
# → {"status":"ok","version":"..."}
```

---

## What you built

In ~45 minutes you went from nothing to a deployed SaaS application with:

- **User accounts** — sign up, sign in, sessions, password reset, RBAC
- **Product catalog** — defined in TypeScript, with a full REST API and admin UI
- **Stripe billing** — checkout, subscriptions, webhooks, license tracking
- **Feature gating** — routes and components that check subscription tier
- **Admin dashboard** — manage products, users, and billing from a browser

This is the foundation. The five primitives — Users, Content, Products, Payments, Intelligence — are all here. Build your business logic on top.

---

## Next steps

- **Add more collections** — orders, reviews, blog posts, anything your business needs
- **Customize the UI** — `packages/presentation` has 58 components to build with
- **Add AI** — Pro tier adds AI agents; see the [AI guide](./AI.md)
- **Invite your team** — role-based access control is already wired in

Need help? [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions) · [Open an issue](https://github.com/RevealUIStudio/revealui/issues)
