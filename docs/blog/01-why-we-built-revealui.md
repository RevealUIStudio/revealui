---
title: "Why I Built RevealUI (and Open-Sourced It)"
description: "*By Joshua Vaughn, RevealUI Studio*"
visibility: public
status: narrative
audience: user
author: Joshua Vaughn
---

I've started three software companies. Each time, I spent the first three to six months building the same thing: user authentication, a content management system, billing integration, an admin dashboard, role-based access control. The actual product (the thing that made the company worth existing) didn't get serious development time until month four at the earliest.

That's not a skills problem. That's an infrastructure problem. And after the third time, I decided to solve it.

RevealUI is the open runtime for businesses that run their own AI. People, Content, Offers, Payments, and Agents (the five primitives every product needs) are pre-wired, open source, and ready to deploy. One codebase. One deployment. Zero months wasted on plumbing.

## The problem nobody talks about

Every software company needs the same five things on day one:

1. **People** - sign up, sign in, sessions, roles, permissions (RBAC + ABAC)
2. **Content** - pages, posts, media, rich text, an API to serve it
3. **Offers** - a catalog, pricing tiers, license keys
4. **Payments** - checkout, subscriptions, invoices, a billing portal
5. **Agents** - AI that actually knows your business context

None of these are your product. All of them are required before your product can exist.

The "modern stack" answer is to stitch together a dozen SaaS tools. Clerk for auth. Stripe for payments. Contentful or Sanity for content. An admin framework like Retool or AdminJS. Maybe a hosted AI API for the intelligence layer. Each tool has its own API, its own billing, its own breaking changes, and its own vendor lock-in.

You end up spending your first months as a system integrator, not a product builder. You're reading five different sets of docs, managing five different API keys, handling five different webhook formats, and praying that the auth provider's session token format is compatible with whatever your admin expects.

I've watched teams burn entire quarters just getting Clerk sessions to propagate correctly to their Payload admin instance while Stripe webhooks fire into a custom endpoint that has to manually reconcile user IDs across three different systems. That's not building a product. That's plumbing.

## Why existing solutions fall short

Let me be specific about what's out there and why none of it solved my problem.

**Headless admin platforms** (Payload, Strapi, Contentful) are excellent at content. Payload in particular is beautifully designed. I have genuine respect for the team. But an admin solves one of the five primitives. You still need auth (yes, Payload has auth, but try integrating it with Stripe tier-gated access control). You still need billing. You still need a product catalog. You still need feature gating that ties your license tier to what content and features a user can access.

**Auth services** (Clerk, Auth0, NextAuth) solve identity. But identity without authorization is half the story. Can this user access this content? Are they on the Pro tier? Has their subscription lapsed? Did they exceed their API rate limit? These questions require auth to know about billing, and billing to know about features. A standalone auth service can't answer them.

**Stripe** handles payments brilliantly. But you still need to build the pricing page that renders tier data, the license key system that enforces access, the webhook handler that updates user roles when a subscription changes, and the billing portal UI that lets users manage their plan. Stripe gives you the engine; you're still building the car.

**Boilerplates and starter kits** get you 60% of the way and then leave you maintaining someone else's code decisions for the next two years. They're a snapshot in time. They don't get security patches. They don't evolve.

The fundamental issue is that these tools were designed in isolation. They don't know about each other. The integration burden falls entirely on you.

## The RevealUI approach

RevealUI treats those five primitives as a single, cohesive system. The architecture follows six engineering principles that govern every decision: **Justifiable** (every default earns its place), **Orthogonal** (clean separation between packages), **Sovereign** (you own everything, deploy anywhere), **Hermetic** (sealed boundaries between concerns), **Unified** (one schema, zero drift), and **Adaptive** (AI and extensibility built into the foundation, not bolted on).

I want to be clear about something: I'm not claiming this is the only way to build software. I'm saying it's *a* way, one that I've tested across three companies and thousands of decisions. If you're staring at a blank repo wondering which ORM, which auth strategy, which deployment model, these six principles give you a defensible answer for each one. Start here. Evolve from here. The principles are starting coordinates, not a cage.

Here's what that looks like in practice.

### Getting started

```bash
npx create-revealui@latest my-app
```

The CLI walks you through database setup, storage, payment configuration, and dev environment preferences. A few minutes later, you have a running application with auth, content management, a REST API, and (if you provided a Stripe key) a fully wired billing system.

### Defining content

Content in RevealUI is defined through collections (typed, access-controlled, hookable data structures):

```typescript
import type { CollectionConfig } from '@revealui/contracts/admin';

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

That's the full definition. Access control, hooks, field validation, and relationship resolution are all declared in one place. The REST API, admin UI, and TypeScript types are derived from this definition automatically.

### Feature gating that actually works

This is where the "integrated system" matters most. RevealUI's feature flags are tied directly to license tiers:

```typescript
import { isFeatureEnabled } from '@revealui/core/features';
import { isLicensed } from '@revealui/core/license';

// Gate a feature by tier
if (isLicensed('pro')) {
  // User has Pro or higher — enable AI agents, payments, MCP
}

// Gate a specific capability
if (isFeatureEnabled('aiLocal')) {
  // Local inference is available at every tier, including Free
}

if (isFeatureEnabled('aiMemory')) {
  // Max tier: working + episodic + vector memory
}
```

The feature system knows the tier hierarchy. The tier hierarchy knows about Stripe. Stripe webhooks update the license in real time. When a user upgrades from Free to Pro, their feature flags update immediately. No manual reconciliation, no cache invalidation dance, no "please refresh the page."

Here's the tier map, straight from the source:

```typescript
const featureTierMap: Record<keyof FeatureFlags, LicenseTier> = {
  aiLocal: 'free',          // local inference ships at every tier
  ai: 'pro',
  mcp: 'pro',
  payments: 'pro',
  advancedSync: 'pro',
  dashboard: 'pro',
  customDomain: 'pro',
  analytics: 'pro',
  vaultDesktop: 'pro',
  vaultRotation: 'pro',
  aiMemory: 'max',
  aiInference: 'max',
  auditLog: 'max',
  devkitProfiles: 'max',
  multiTenant: 'enterprise',
  whiteLabel: 'enterprise', // managed setup via RevForge; see Fleet docs
  sso: 'enterprise',        // OIDC + SAML SP-initiated under the sso gate
};
```

Free tier gets the full runtime engine, auth, the REST API, and local AI inference (Inference Snaps or Ollama, no API key, no cloud bill). Pro unlocks AI agents, payments, sync, MCP, and the monitoring dashboard. Max adds AI memory and advanced inference configuration. Enterprise adds multi-tenant management, RevealUI Fleet (branded white-label via RevForge), and Enterprise SSO (OIDC + SAML SP-initiated; operator guide [FORGE_SSO_SETUP](../FORGE_SSO_SETUP.md); tracker [#449](https://github.com/RevealUIStudio/revealui/issues/449)).

### Pricing served from a single source, not hardcoded

One thing I got wrong early on: I hardcoded prices in the frontend. Then I changed them. Then I forgot to update one of the three places they appeared. Never again.

RevealUI serves tier and pricing data from a single API endpoint. The contracts package defines the tier structure and feature lists; the API route merges in live prices from Stripe when it's configured:

```
GET /api/pricing
```

```json
{
  "subscriptions": [
    {
      "id": "free",
      "name": "Free (OSS)",
      "description": "Perfect for trying out RevealUI and small projects.",
      "features": [
        "Unlimited admin collections",
        "1 site",
        "Up to 3 users/editors",
        "Session-based auth",
        "Local AI inference (Inference Snaps / Ollama)",
        "Full source code access"
      ]
    },
    {
      "id": "pro",
      "name": "Pro",
      "description": "For software companies building production products.",
      "features": [
        "Up to 5 sites",
        "Up to 25 users/editors",
        "AI agents (local + cloud via the RevealUI harness)",
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

The marketing site, admin billing page, and upgrade prompts all read from this endpoint. Subscription prices come from Stripe when configured; the public price points are being finalized ahead of launch, so the endpoint serves tier structure and feature lists today. The contracts package is the single source of truth. Change the structure in one place and it propagates everywhere. No duplication.

### Auth without the complexity

RevealUI uses session-based auth. No JWTs. No token rotation. No "your refresh token expired and now the user is logged out mid-checkout."

Sessions are stored server-side. The cookie is `httpOnly`, `secure`, `sameSite=lax`, scoped to `.revealui.com` for cross-subdomain access. Password hashing uses bcrypt with 12 rounds. Rate limiting and brute force protection are built in. OAuth works with GitHub, Google, and Vercel out of the box.

I made this choice deliberately. JWTs are appropriate for distributed microservice architectures where services can't share a session store. RevealUI is a monolithic deployment where the admin, API, and auth layer all run in the same process or share the same database. Sessions are simpler, more secure (instant revocation), and eliminate an entire class of bugs around token expiry and refresh races. License keys are a separate story. Those are signed JWTs (EdDSA/Ed25519) because they're verified offline by self-hosted deployments. Different problem, different tool.

## Why open source

MIT. Non-negotiable for the core.

I've been on the other side of this equation. I've built production systems on commercial platforms that raised their prices 3x, changed their API without warning, or got acquired and sunset. Every time, I wished I had the source code.

RevealUI's business primitives (auth, content, collections, the REST API, the admin dashboard, the CLI, the component library) are MIT licensed. You can inspect every line. You can fork it. You can self-host it on your own infrastructure. You can rip out the parts you don't need and keep the parts you do.

The business model is straightforward: the Pro tier (AI agents, the memory system, the MCP framework, open-model orchestration) funds ongoing development. The things that make RevealUI useful for most use cases are free forever. The things teams need for AI capabilities are commercially licensed but source-available.

To be precise about the split: 25 of the 32 packages are MIT, forever. The five Pro packages (`@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, and `@revealui/services`) are Fair Source under FSL-1.1-MIT: source-visible, commercially usable, and they convert to MIT two years after each release. Two workspace packages carry no public license: internal build tooling and an Apify actor scaffold. MCP integration is a Pro capability today, not a free add-on. I'd rather be honest about where the line sits than blur it. You can read every line of the Pro code on npm; the license key unlocks the features, it doesn't hide the source.

## What makes RevealUI different

RevealUI is not an admin with plugins bolted on. It's not a boilerplate you clone and hack. It's a cohesive system designed from the ground up so that every primitive knows about every other primitive. This is the **Unified** and **Hermetic** design principles in practice. One schema is shared across every layer, with sealed boundaries between concerns so auth never leaks into billing and content never tangles with payments.

When a user signs up, the auth system creates their session, assigns their default role, and checks their license tier. When they access content, the collection's `access.read` function can reference their tier, their role, or any custom claim. When they upgrade via Stripe, the webhook handler updates their license, which updates their feature flags, which unlocks gated content and capabilities, all in the same request cycle.

This is the part that's genuinely hard to replicate by stitching services together. The integration isn't in the glue code between separate tools. The integration is in the data model. People, content, offers, payments, and agents share a schema. They share a database. They share a session. The relationships are first-class, not afterthoughts.

Some numbers on what's actually shipped:

- **38 workspaces** across the monorepo (6 apps, 32 packages with 25 MIT, 5 Fair Source, 2 internal)
- **104 database tables** via Drizzle ORM on NeonDB (Postgres)
- **66 UI components** in `@revealui/presentation`, with one third-party runtime dependency (`tailwind-merge`), built directly on Tailwind v4 and React, with `cva` and `cn` vendored in-package
- **13 first-party MCP servers** in `@revealui/mcp`
- **Unit, integration, and E2E tests** across the monorepo (run `pnpm test` for the current count)
- **Full OpenAPI spec** with Swagger UI at `/docs`
- **Session auth** with bcrypt, rate limiting, brute force protection, and OAuth

## The trade-offs

I want to be honest about where RevealUI is and isn't the right choice.

**It's opinionated.** That's the **Justifiable** principle. Every choice has a reason you can explain in one sentence. React 19, Next.js 16, Hono, Drizzle ORM, NeonDB, Tailwind v4. If you need Vue or Svelte on the frontend, RevealUI isn't for you today. The API layer (Hono) is framework-agnostic and serves standard REST, so you could consume it from any frontend. But the admin dashboard is React. The point isn't that these are the *right* choices for every team. It's that they're a coherent set of choices that work well together. When your needs outgrow a specific tool, swap it. The **Orthogonal** architecture means nothing is welded shut.

**It's early.** This is a v0. The core is stable (unit and integration tests, full TypeScript strict mode, security hardening). Run `pnpm test` for the current count. **Stripe is live** in production. The third-party plugin marketplace is still early. The template library is small. The community is just getting started. I keep an honest, file-by-file account of what does and doesn't work at [What Works Today](../WHAT_WORKS_TODAY.md).

**It's a solo project.** I'm one developer at RevealUI Studio. The upside is that decisions are fast and the vision is coherent. The downside is that there's one person triaging issues and reviewing PRs. I'm building in public precisely because I need the community to grow with the project.

**It's not serverless-native.** RevealUI assumes a database. It assumes persistent sessions. It works great on Vercel (that's where the studio's own sites run), but it's not a collection of edge functions with no state. The architecture is a traditional web application deployed to modern infrastructure. I think that's the right trade-off for a system that needs ACID transactions across auth, billing, and content.

## What's next

The repository is public on GitHub. The docs site is live at [docs.revealui.com](https://docs.revealui.com). The `create-revealui` CLI is on npm. You can stand up a full RevealUI instance today.

RevDev Studio (Tauri + React) is the native AI experience for agent coordination, local inference management, and a visual dashboard. A terminal client (Go + Bubble Tea) gives you a TUI for API access and license lookups.

The near-term roadmap includes MCP server registry listings, A2A agent discovery for RevealUI-to-RevealUI communication, a broader template library, and a template marketplace where developers can publish project starters. The community lives on [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions), so join early and help shape what gets built next.

But the core thesis won't change: **every software company needs People, Content, Offers, Payments, and Agents. You shouldn't have to build them from scratch.**

Build your business, not your boilerplate.

---

*RevealUI is MIT licensed (Pro packages are Fair Source, FSL-1.1-MIT) and available on [GitHub](https://github.com/RevealUIStudio/revealui). Get started with `npx create-revealui`.*

*If you have questions, find a bug, or want to contribute, open an issue or reach out at founder@revealui.com.*
