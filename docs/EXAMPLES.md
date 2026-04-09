---
title: "Example Projects"
description: "Sample applications and use cases built with RevealUI"
category: tutorial
audience: developer
---

# Example Projects

Three complete examples showing how to build real products with RevealUI. Each example includes the full collection definitions, config, and API usage patterns.

---

## 1. Blog

A content-driven blog with posts, authors, categories, and a public REST API. The simplest RevealUI starting point.

**What you get:**

- Posts with rich text, cover images, and live preview
- Author profiles linked to user accounts
- Category taxonomy
- Public REST API at `/api/posts`
- Draft/publish workflow

### Scaffold

```bash
npx @revealui/cli@latest my-blog
# Choose: basic-blog template
```

### Collections

**`collections/Posts.ts`**

```ts
import { defineCollection } from "@revealui/core";
import {
  lexicalEditor,
  HeadingFeature,
  BlocksFeature,
} from "@revealui/core/richtext";
import { slugField } from "./fields/slug";

export const Posts = defineCollection({
  slug: "posts",
  access: {
    read: () => true, // public
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "publishedAt"],
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField,
    {
      name: "content",
      type: "richText",
      editor: lexicalEditor({
        features: [
          HeadingFeature({ enabledHeadingSizes: ["h2", "h3"] }),
          BlocksFeature(),
        ],
      }),
    },
    { name: "coverImage", type: "upload", relationTo: "media" },
    { name: "author", type: "relationship", relationTo: "users" },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
    },
    {
      name: "status",
      type: "select",
      options: ["draft", "published"],
      defaultValue: "draft",
    },
    { name: "publishedAt", type: "date" },
  ],
  hooks: {
    beforeChange: [setPublishedAt],
  },
});
```

**`collections/Categories.ts`**

```ts
export const Categories = defineCollection({
  slug: "categories",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true },
    slugField,
    { name: "description", type: "textarea" },
  ],
});
```

### Config

```ts
// revealui.config.ts
import { buildConfig } from "@revealui/core";
import { Posts } from "./collections/Posts";
import { Categories } from "./collections/Categories";
import { Media } from "./collections/Media";

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
  secret: process.env.REVEALUI_SECRET,
  collections: [Posts, Categories, Media],
  admin: { user: "users" },
});
```

### Fetching Posts

```ts
// In your frontend (Next.js, Vite, etc.)
const res = await fetch(
  "https://your-cms.com/api/posts?where[status][equals]=published&sort=-publishedAt&limit=10",
);
const { docs: posts } = await res.json();
```

---

## 2. SaaS Starter

A subscription-based SaaS with Stripe billing, tiered feature access, and an admin dashboard. The full business stack in one project.

**What you get:**

- User accounts with role-based access (admin, member, viewer)
- Stripe subscriptions with free/pro/enterprise tiers
- Feature flags gating UI and API by plan
- License key issuance on checkout completion
- Billing portal for self-service plan changes
- Admin dashboard showing MRR, churn, active users

### Scaffold

```bash
npx @revealui/cli@latest my-saas
# Choose: e-commerce template (Pro license required)
# Enter Stripe keys when prompted
```

### Collections

**`collections/Products.ts`**

```ts
export const Products = defineCollection({
  slug: "products",
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "description", type: "richText" },
    { name: "stripeId", type: "text" }, // Stripe Product ID
    {
      name: "tier",
      type: "select",
      options: ["free", "pro", "enterprise"],
      required: true,
    },
    {
      name: "prices",
      type: "relationship",
      relationTo: "prices",
      hasMany: true,
    },
    { name: "active", type: "checkbox", defaultValue: true },
  ],
});
```

**`collections/Prices.ts`**

```ts
export const Prices = defineCollection({
  slug: "prices",
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: { useAsTitle: "stripePriceId" },
  fields: [
    { name: "stripePriceId", type: "text", required: true },
    { name: "amount", type: "number", required: true }, // in cents
    {
      name: "interval",
      type: "select",
      options: ["month", "year"],
    },
    { name: "currency", type: "text", defaultValue: "usd" },
    { name: "active", type: "checkbox", defaultValue: true },
  ],
});
```

### Feature Gating

```ts
import { isFeatureEnabled, isLicensed } from '@revealui/core'

// In a React component (client):
export function AiAssistant() {
  if (!isFeatureEnabled('ai')) {
    return <UpgradePrompt feature="AI assistant" requiredTier="pro" />
  }
  return <AiChat />
}

// In an API handler (server):
export async function POST(req: Request) {
  if (!isLicensed('pro')) {
    return new Response('Upgrade required', { status: 402 })
  }
  // ... handle request
}
```

### Stripe Webhook Handler

```ts
// apps/admin/src/app/api/webhooks/stripe/route.ts
import Stripe from "stripe";
import { getRestClient } from "@revealui/db/client";
import { licenses } from "@revealui/db/schema/licenses";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    sig,
    process.env.STRIPE_WEBHOOK_SECRET,
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const db = getRestClient();

    // Issue license key
    await db.insert(licenses).values({
      id: crypto.randomUUID(),
      userId: session.metadata?.userId,
      tier: session.metadata?.tier ?? "pro",
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      status: "active",
      issuedAt: new Date(),
    });
  }

  return new Response("ok");
}
```

---

## 3. Product Catalog & Storefront

A public-facing product catalog with a Stripe checkout flow. No subscription required — one-time purchases and license keys.

**What you get:**

- Product catalog with variants, images, and pricing
- Stripe Checkout for one-time purchases
- License key delivery via email on payment completion
- Order history in the admin dashboard
- Public API for frontend storefronts

### Scaffold

```bash
npx @revealui/cli@latest my-store
# Choose: e-commerce template (Pro license required)
```

### Collections

**`collections/Orders.ts`**

```ts
export const Orders = defineCollection({
  slug: "orders",
  access: {
    read: isAdmin,
    create: () => true,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: "id",
    defaultColumns: ["id", "status", "total", "createdAt"],
  },
  fields: [
    { name: "stripePaymentIntentId", type: "text" },
    { name: "customer", type: "relationship", relationTo: "users" },
    {
      name: "products",
      type: "relationship",
      relationTo: "products",
      hasMany: true,
    },
    { name: "total", type: "number" }, // in cents
    { name: "currency", type: "text", defaultValue: "usd" },
    {
      name: "status",
      type: "select",
      options: ["pending", "paid", "refunded", "failed"],
      defaultValue: "pending",
    },
    { name: "licenseKey", type: "text" }, // issued after payment
    { name: "createdAt", type: "date" },
  ],
});
```

### Checkout Flow

```ts
// 1. Create Stripe Checkout session
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [
    {
      price: product.stripePriceId,
      quantity: 1,
    },
  ],
  success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/store`,
  metadata: { productId: product.id, userId: user.id },
});

// 2. On webhook completion — issue license and email customer
if (event.type === "checkout.session.completed") {
  const licenseKey = await generateLicenseKey(
    { tier: "pro", customerId: session.customer as string },
    process.env.REVEALUI_LICENSE_PRIVATE_KEY,
  );

  await db
    .update(orders)
    .set({ status: "paid", licenseKey })
    .where(eq(orders.stripePaymentIntentId, session.payment_intent as string));

  await sendLicenseEmail({ to: session.customer_email, licenseKey, product });
}
```

### Public API Query

```ts
// Fetch all active products for your storefront
const res = await fetch(
  "https://your-cms.com/api/products" +
    "?where[active][equals]=true" +
    "&depth=1" +
    "&sort=name",
);
const { docs: products } = await res.json();
```

---

## Common Patterns

### Protecting API Routes

```ts
import { getSession } from "@revealui/auth/server";

export async function GET(req: Request) {
  const session = await getSession(req.headers);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... authenticated handler
}
```

### Access Control Functions

```ts
import { anyone, authenticated } from '@revealui/core'

// Built-in helpers
access: {
  read: anyone,          // public
  create: authenticated, // signed-in users
  update: ({ req }) => req.user?.role === 'admin',
  delete: ({ req }) => req.user?.role === 'admin',
}
```

### Slug Field (shared)

```ts
// collections/fields/slug.ts
import type { Field } from "@revealui/core";

export const slugField: Field = {
  name: "slug",
  type: "text",
  required: true,
  unique: true,
  admin: {
    position: "sidebar",
    description: "URL-safe identifier. Auto-generated from title.",
  },
  hooks: {
    beforeValidate: [
      ({ data, siblingData }) => {
        if (!data && siblingData?.title) {
          return siblingData.title
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");
        }
        return data;
      },
    ],
  },
};
```

---

## Related

- [Quick start guide](/guides/quick-start) — Get your first project running
- [`@revealui/cli`](/reference/cli) — Full CLI reference
- [`@revealui/core`](/reference/core) — `defineCollection`, `buildConfig`, feature flags
- [`@revealui/auth`](/reference/auth) — Session auth and access control
