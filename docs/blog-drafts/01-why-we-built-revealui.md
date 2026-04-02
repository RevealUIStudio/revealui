# Why We Built RevealUI

Every engineering team I have worked with builds the same things. Authentication. A content management layer. Product catalogs. Payment integrations. Maybe an AI feature if the roadmap is ambitious enough. These are not differentiating features. They are prerequisites. And yet they consume months of engineering time before a single line of business logic gets written.

RevealUI exists because that cycle is broken.

---

## The Problem

Start a new SaaS project today and you will immediately reach for a dozen libraries: an auth provider, a headless CMS, a payment wrapper, a database ORM, a UI component library, an API framework. Each has its own conventions, its own configuration format, its own upgrade cadence, and its own breaking changes. You spend the first quarter of your project stitching these together into something that works. You spend the next quarter fixing the seams.

This is not a tooling problem. The individual tools are excellent. Next.js, Stripe, Drizzle, Tailwind -- each is best-in-class. The problem is integration. Nobody ships a library for "make all these things work together." That integration layer is what every team rebuilds from scratch, and it is where most of the bugs live.

RevealUI is that integration layer.

---

## What RevealUI Is

RevealUI is an agentic business runtime. It is not a CMS. It is not a framework. It is the infrastructure layer that every software business needs, pre-assembled and ready to deploy.

Five primitives:

1. **Users** -- Session-based auth, OAuth, MFA, passkeys, RBAC, brute force protection. Not a wrapper around Auth0. A complete implementation with 58 enforcement tests proving role isolation.

2. **Content** -- Collections with typed schemas, Lexical rich text, draft/publish workflow, per-field access control, REST API auto-generated from schemas. Content is stored as structured data, not markdown files in a Git repo.

3. **Products** -- License key generation (RSA-signed JWTs), feature gating by tier, runtime enforcement. Four tiers: free, pro, max, enterprise. The feature gate is a single function call, not a configuration file.

4. **Payments** -- Stripe end-to-end: checkout, portal, subscriptions, usage metering, webhook idempotency, circuit breaker protection. Chargebacks auto-revoke licenses. Failed payments trigger grace periods. Every webhook is deduplicated at the database level.

5. **Intelligence** -- AI agent orchestration with streaming, CRDT-based memory, BYOK (bring your own key) for LLM providers, MCP servers for tool access, and A2A protocol for inter-agent communication. Pro tier only, because running AI costs real money.

These five are not independent features bolted together. They form a directed graph of dependencies: Users author Content. Users purchase Products. Products gate Content and Intelligence. Payments generate Products. Intelligence creates Content and bills through Payments. Every edge in that graph is integration code you do not have to write.

---

## Why Open Source

RevealUI's core is MIT licensed. Not AGPL, not BSL, not source-available-with-caveats. MIT. You can fork it, rebrand it, sell it, deploy it on your own infrastructure, and never pay us anything. That is the deal.

The reasoning is simple: the four business primitives (Users, Content, Products, Payments) are table stakes. Making them proprietary would limit adoption without meaningfully protecting revenue. The value is not in the code -- it is in the integration, the maintenance, and the velocity of shipping new features on a stable foundation.

Intelligence (AI) is the Pro tier. Agent orchestration, memory systems, and MCP servers require compute that costs real money. The Pro license funds continued development of the entire platform, including the MIT core.

This is the PostHog model, the Sentry model, the GitLab model: open core with commercial extensions. The difference is that RevealUI ships both on day one. You do not get an open source skeleton with a "contact sales" button on every useful feature. You get a working business platform with an optional AI upgrade.

---

## The Technical Choices

Every framework is a set of opinions. Here are ours:

**Sessions over JWTs.** JWTs cannot be revoked before expiry. Database-backed sessions can be revoked instantly. The tradeoff is one indexed query per request, which PostgreSQL handles in under a millisecond.

**Drizzle over Prisma.** Drizzle generates SQL you can read. Its query builder maps directly to SQL operations. No magic, no query engine, no binary you cannot inspect.

**Hono over Express.** Hono is built for the edge. It runs on Node, Deno, Bun, and Cloudflare Workers with the same code. Its OpenAPI integration generates documentation from route handlers, not from a separate spec file.

**Lexical over ProseMirror.** Lexical's data model is JSON, not a custom AST. Server-side rendering works without a browser. XSS prevention is structural: every URL is validated before rendering.

**Tailwind over CSS-in-JS.** No runtime cost. No hydration mismatch. The entire component library (52 components) uses only Tailwind utilities, clsx, and CVA. Zero external UI dependencies.

**Biome over ESLint + Prettier.** One tool instead of two. Faster. No plugin ecosystem to manage. The formatter and linter share a single AST parse.

---

## What Ships Today

RevealUI launched with:

- **18 npm packages** published to the public registry
- **76 database tables** via Drizzle ORM (NeonDB + Supabase)
- **52 UI components** with zero external dependencies
- **6 MCP servers** for AI tool access (all MIT)
- **13,700+ tests** across all packages
- **4 GitHub template repos** for different starting points

You can start right now:

```bash
npx create-revealui
```

That command scaffolds a full project with auth, content, products, payments, and optionally AI -- configured, typed, tested, and ready for `pnpm dev`.

---

## What Comes Next

RevealUI is a solo-founder project in its first week of public availability. The roadmap is driven by what users actually need, not what a VC board thinks will maximize ARR.

Near-term priorities:

- **Deployment guides** for Vercel, Railway, Fly.io, and self-hosted Docker
- **Plugin system** for extending collections and routes without forking
- **Dashboard analytics** for content, users, and revenue
- **Mobile-first admin** via the Studio companion app

The codebase is on GitHub. The documentation is at docs.revealui.com. If you have questions, the fastest path is a GitHub Discussion or the community forum.

Build your business, not your boilerplate.

---

*RevealUI is an agentic business runtime. The core framework is MIT licensed and free forever. Pro features (AI agents, memory, MCP orchestration) are available with a Pro license. Learn more at [revealui.com](https://revealui.com).*
