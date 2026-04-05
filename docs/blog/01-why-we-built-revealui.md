# Why I Built RevealUI (and Open-Sourced It)

*By Joshua Vaughn — RevealUI Studio*

---

I've started three software companies. Each time, I spent the first three to six months building the same thing: user authentication, a content management system, billing integration, an admin dashboard, role-based access control. The actual product — the thing that made the company worth existing — didn't get serious development time until month four at the earliest.

That's not a skills problem. That's an infrastructure problem. And after the third time, I decided to solve it.

RevealUI is an agentic business runtime. Users, content, products, payments, and AI — pre-wired, open source, and ready to deploy. One codebase. One deployment. Zero months wasted on plumbing.

## The problem nobody talks about

Every software company needs the same five things on day one:

1. **Users** — sign up, sign in, sessions, roles, permissions
2. **Content** — pages, posts, media, rich text, an API to serve it
3. **Products** — a catalog, pricing tiers, license keys
4. **Payments** — checkout, subscriptions, invoices, a billing portal
5. **Intelligence** — AI that actually knows your business context

None of these are your product. All of them are required before your product can exist.

The "modern stack" answer is to stitch together a dozen SaaS tools. Clerk for auth. Stripe for payments. Contentful or Sanity for content. An admin framework like Retool or AdminJS. Maybe Vercel's AI SDK for the intelligence layer. Each tool has its own API, its own billing, its own breaking changes, and its own vendor lock-in.

You end up spending your first months as a system integrator, not a product builder. You're reading five different sets of docs, managing five different API keys, handling five different webhook formats, and praying that the auth provider's session token format is compatible with whatever your CMS expects.

I've watched teams burn entire quarters just getting Clerk sessions to propagate correctly to their Payload CMS instance while Stripe webhooks fire into a custom endpoint that has to manually reconcile user IDs across three different systems. That's not building a product. That's plumbing.

## Why existing solutions fall short

Let me be specific about what's out there and why none of it solved my problem.

**Headless CMS platforms** (Payload, Strapi, Contentful) are excellent at content. Payload in particular is beautifully designed — I have genuine respect for the team. But a CMS solves one of the five primitives. You still need auth (yes, Payload has auth, but try integrating it with Stripe tier-gated access control). You still need billing. You still need a product catalog. You still need feature gating that ties your license tier to what content and features a user can access.

**Auth services** (Clerk, Auth0, NextAuth) solve identity. But identity without authorization is half the story. Can this user access this content? Are they on the Pro tier? Has their subscription lapsed? Did they exceed their API rate limit? These questions require auth to know about billing, and billing to know about features. A standalone auth service can't answer them.

**Stripe** handles payments brilliantly. But you still need to build the pricing page that renders tier data, the license key system that enforces access, the webhook handler that updates user roles when a subscription changes, and the billing portal UI that lets users manage their plan. Stripe gives you the engine; you're still building the car.

**Boilerplates and starter kits** get you 60% of the way and then leave you maintaining someone else's code decisions for the next two years. They're a snapshot in time. They don't get security patches. They don't evolve.

The fundamental issue is that these tools were designed in isolation. They don't know about each other. The integration burden falls entirely on you.

## The RevealUI approach

RevealUI treats those five primitives as a single, cohesive system. The architecture follows what I call the **JOSHUA Stack** — six engineering principles that govern every decision: **Justifiable** (every default earns its place), **Orthogonal** (clean separation between packages), **Sovereign** (you own everything, deploy anywhere), **Hermetic** (sealed boundaries between concerns), **Unified** (one schema, zero drift), and **Adaptive** (AI and extensibility built into the foundation, not bolted on).

I want to be clear about something: I'm not claiming this is the only way to build software. I'm saying it's *a* way — one that I've tested across three companies and thousands of decisions. If you're staring at a blank repo wondering which ORM, which auth strategy, which deployment model, the JOSHUA Stack gives you a defensible answer for each one. Start here. Evolve from here. The principles are starting coordinates, not a cage.

Here's what that looks like in practice.

### Getting started

```bash
npx create-revealui my-app
```

The CLI walks you through database setup, payment configuration, and dev environment preferences. Three minutes later, you have a running application with auth, content management, a REST API, and (if you provided a Stripe key) a fully wired billing system.

### Defining content

Content in RevealUI is defined through collections — typed, access-controlled, hookable data structures:

```typescript
import type { CollectionConfig } from '@revealui/contracts/cms';

const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Post', plural: 'Posts' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'richText' },
    { name: 'status', type: 'select', options: ['draft', 'published'] },
    { name: 'author', type: 'relationship', relationTo: 'users' },
  ],
  access: {
    read: ({ req }) => {
      // Published posts are public; drafts require auth
      if (!req.user) return { status: { equals: 'published' } };
      return true;
    },
    create: ({ req }) => !!req.user,
    update: ({ req }) => req.user?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          data.createdAt = new Date().toISOString();
        }
        return data;
      },
    ],
  },
};
```

That's the full definition. Access control, hooks, field validation, relationship resolution — it's all declared in one place. The REST API, admin UI, and TypeScript types are derived from this definition automatically.

### Feature gating that actually works

This is where the "integrated system" matters most. RevealUI's feature flags are tied directly to license tiers:

```typescript
import { isFeatureEnabled } from '@revealui/core/features';
import { isLicensed } from '@revealui/core/license';

// Gate a feature by tier
if (isLicensed('pro')) {
  // User has Pro or higher — enable billing features
}

// Gate a specific capability
if (isFeatureEnabled('ai')) {
  // AI agents are available
}

if (isFeatureEnabled('aiMemory')) {
  // Max tier: working + episodic + vector memory
}
```

The feature system knows the tier hierarchy. The tier hierarchy knows about Stripe. Stripe webhooks update the license in real time. When a user upgrades from Free to Pro, their feature flags update immediately — no manual reconciliation, no cache invalidation dance, no "please refresh the page."

Here's the tier map, straight from the source:

```typescript
const featureTierMap: Record<keyof FeatureFlags, LicenseTier> = {
  ai: 'pro',
  mcp: 'pro',
  payments: 'pro',
  advancedSync: 'pro',
  dashboard: 'pro',
  customDomain: 'pro',
  analytics: 'pro',
  aiMemory: 'max',
  aiInference: 'max',
  auditLog: 'max',
  multiTenant: 'enterprise',
  whiteLabel: 'enterprise',
  sso: 'enterprise',
};
```

Free tier gets the full CMS framework, auth, and REST API. Pro unlocks payments, AI, sync, and monitoring. Max adds AI memory, advanced inference configuration, and compliance tooling. Forge adds multi-tenant architecture, white-labeling (planned), and SSO (planned).

### Pricing served from Stripe, not hardcoded

One thing I got wrong early on: I hardcoded prices in the frontend. Then I changed them. Then I forgot to update one of the three places they appeared. Never again.

RevealUI serves pricing data from a single API endpoint. Prices come from Stripe when configured, with server-side fallbacks for development:

```
GET /api/pricing
```

```json
{
  "subscriptions": [
    {
      "id": "free",
      "name": "Free (OSS)",
      "price": "$0",
      "description": "Perfect for trying out RevealUI and small projects.",
      "features": [
        "Unlimited CMS collections",
        "1 site",
        "Up to 3 users/editors",
        "Session-based auth",
        "Full source code access"
      ]
    },
    {
      "id": "pro",
      "name": "Pro",
      "price": "$49",
      "period": "/month",
      "description": "For software companies building production products.",
      "features": [
        "Up to 5 sites",
        "Up to 25 users/editors",
        "AI agents (open-model inference)",
        "Built-in Stripe payments",
        "Monitoring dashboard",
        "10,000 agent tasks/month"
      ]
    }
  ],
  "credits": [...],
  "perpetual": [...]
}
```

The marketing site, CMS billing page, and upgrade prompts all read from this endpoint. Change a price in Stripe and it propagates everywhere within an hour (the response is cached with `s-maxage=3600, stale-while-revalidate=86400`). The contracts package defines the tier structure and feature lists. The API route merges in live prices. No duplication.

### Auth without the complexity

RevealUI uses session-based auth. No JWTs. No token rotation. No "your refresh token expired and now the user is logged out mid-checkout."

Sessions are stored server-side. The cookie is `httpOnly`, `secure`, `sameSite=lax`, scoped to `.revealui.com` for cross-subdomain access. Password hashing uses bcrypt with 12 rounds. Rate limiting and brute force protection are built in. OAuth works with GitHub, Google, and Vercel out of the box.

I made this choice deliberately. JWTs are appropriate for distributed microservice architectures where services can't share a session store. RevealUI is a monolithic deployment — the CMS, API, and auth layer all run in the same process or share the same database. Sessions are simpler, more secure (instant revocation), and eliminate an entire class of bugs around token expiry and refresh races.

## Why open source

MIT. Non-negotiable.

I've been on the other side of this equation. I've built production systems on commercial platforms that raised their prices 3x, changed their API without warning, or got acquired and sunset. Every time, I wished I had the source code.

RevealUI's business primitives — auth, content, collections, the REST API, the admin dashboard, the CLI, the component library — are MIT licensed. You can inspect every line. You can fork it. You can self-host it on your own infrastructure. You can rip out the parts you don't need and keep the parts you do.

The business model is straightforward: the Pro tier (AI agents, memory system, open-model inference) funds ongoing development. The things that make RevealUI useful for 90% of use cases are free forever. The things that make it powerful for teams that need AI capabilities are commercially licensed but source-available — you can read every line of the Pro code too.

I also open-sourced the MCP framework (hypervisor, adapter base classes, and database adapter). It was originally Pro-only, but the ecosystem benefits more from it being open. AI tooling should be open infrastructure, not a profit center.

## What makes RevealUI different

RevealUI is not a CMS with plugins bolted on. It's not a boilerplate you clone and hack. It's a cohesive system designed from the ground up so that every primitive knows about every other primitive. This is the JOSHUA Stack's **Unified** and **Hermetic** principles in practice — one schema shared across every layer, but with sealed boundaries between concerns so auth never leaks into billing and content never tangles with payments.

When a user signs up, the auth system creates their session, assigns their default role, and checks their license tier. When they access content, the collection's `access.read` function can reference their tier, their role, or any custom claim. When they upgrade via Stripe, the webhook handler updates their license, which updates their feature flags, which unlocks gated content and capabilities — all in the same request cycle.

This is the part that's genuinely hard to replicate by stitching services together. The integration isn't in the glue code between separate tools. The integration is in the data model. Users, content, products, payments, and features share a schema. They share a database. They share a session. The relationships are first-class, not afterthoughts.

Some numbers on what's actually shipped:

- **28 packages** across the monorepo (7 apps, 16 OSS libraries, and 5 Pro packages)
- **71 database tables** via Drizzle ORM
- **52 UI components** in the presentation layer (zero external UI dependencies — just Tailwind v4, clsx, and CVA)
- **13,700+ tests** across all packages
- **Full OpenAPI spec** with Swagger UI at `/docs`
- **Session auth** with bcrypt, rate limiting, brute force protection, and OAuth

## The trade-offs

I want to be honest about where RevealUI is and isn't the right choice.

**It's opinionated.** That's the **Justifiable** principle — every choice has a reason you can explain in one sentence. React 19, Next.js 16, Hono, Drizzle ORM, NeonDB, Tailwind v4. If you need Vue or Svelte on the frontend, RevealUI isn't for you today. The API layer (Hono) is framework-agnostic and serves standard REST, so you could consume it from any frontend — but the admin dashboard and CMS are React. The point isn't that these are the *right* choices for every team — it's that they're a coherent set of choices that work well together. If you're not sure what to pick, this is a slam dunk starting point. When your needs outgrow a specific tool, swap it — the **Orthogonal** architecture means nothing is welded shut.

**It's early.** This is a v0 launch. The core is stable (5,500+ tests, full TypeScript strict mode, comprehensive security hardening), but the ecosystem is young. There's no plugin marketplace yet. The template library is small. The community is just getting started.

**It's a solo project.** I'm one developer at RevealUI Studio. The upside is that decisions are fast and the vision is coherent. The downside is that there's one person triaging issues and reviewing PRs. I'm building in public precisely because I need the community to grow with the project.

**It's not serverless-native.** RevealUI assumes a database. It assumes persistent sessions. It works great on Vercel (that's the primary deployment target), but it's not a collection of edge functions with no state. The architecture is a traditional web application deployed to modern infrastructure — and I think that's the right trade-off for a system that needs ACID transactions across auth, billing, and content.

## What's next

The repository is public on GitHub. The docs site is live at [docs.revealui.com](https://docs.revealui.com). The `create-revealui` CLI is on npm. You can stand up a full RevealUI instance today.

The Studio desktop companion (Tauri + React) and a terminal client (Go + Bubble Tea) are already in the monorepo — giving you both a visual DevPod manager and a TUI for API access, QR checkout, and SSH fingerprint lookup.

The near-term roadmap includes MCP server registry listings, A2A agent discovery for RevealUI-to-RevealUI communication, a broader template library, and the template marketplace where developers can publish and sell project starters. The community forum is at [revnation.discourse.group](https://revnation.discourse.group) — join early and help shape what gets built next.

But the core thesis won't change: **every software company needs users, content, products, payments, and intelligence. You shouldn't have to build them from scratch.**

Build your business, not your boilerplate.

---

*RevealUI is MIT licensed and available on [GitHub](https://github.com/RevealUIStudio/revealui). Get started with `npx create-revealui`.*

*If you have questions, find a bug, or want to contribute, open an issue or reach out at founder@revealui.com.*
