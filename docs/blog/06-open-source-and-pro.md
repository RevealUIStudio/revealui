# Open Source + Pro: How We Think About Monetization

RevealUI is launching this week. Before we talk about features or roadmaps, I want to be completely transparent about how we make money, what's free, what's paid, and why.

This is a solo-founder project. I don't have a VC board to answer to or a growth team optimizing conversion funnels. I have a business model I believe in, and I'd rather explain it plainly than have you discover the trade-offs later.

---

## The MIT Commitment

RevealUI's core is MIT licensed. Not AGPL, not SSPL, not BSL, not "source-available with a Commons Clause." MIT.

I chose MIT because it's the simplest license that exists. No restrictions, no gotchas, no "well actually, you can't host it as a service." You can fork it, sell it, white-label it, build a competing product on top of it, and never pay me a cent. That's the deal.

This wasn't a naive decision. I'm aware of the arguments for more restrictive licenses. AGPL forces service providers to release their modifications. BSL gives you a time-delayed open source release. SSPL tries to close the "cloud loophole." Each of these exists because companies got burned by cloud providers reselling their work without contributing back.

I understand that risk. I accept it. Here's why.

RevealUI is an agentic business runtime. The four business primitives that make it useful -- Users, Content, Products, Payments -- are MIT licensed and will stay MIT forever. These are table stakes. Every business needs auth, a content system, a product catalog, and payment processing. Making these proprietary would limit adoption without meaningfully protecting revenue. The value isn't in the code; it's in the integration, the maintenance, and the roadmap.

Our MCP servers are MIT too. We open-sourced them intentionally. MCP servers are distribution infrastructure -- the more people who use them, build on them, and extend them, the more valuable the ecosystem becomes. Restricting MCP servers to paying customers would be optimizing for short-term revenue at the cost of long-term reach.

What MIT means practically: you can take RevealUI, strip the branding, deploy it on your own infrastructure, and run your entire business on it without ever creating an account with us. You don't owe us attribution, revenue share, or even a thank-you. The code is yours.

---

## What's Pro and Why

If everything important is MIT, what's left to sell?

Intelligence.

RevealUI Pro includes:

- **AI agents** -- task execution, multi-step workflows, autonomous operations
- **CRDT memory** -- working memory, episodic memory, and vector storage that persists across agent sessions
- **LLM orchestration** -- open-model inference via Ubuntu Inference Snaps and Ollama
- **Editor integrations** -- daemon adapters for Zed, VS Code, and Neovim
- **Harness coordination** -- workboard-based agent orchestration, JSON-RPC communication, daemon management

These features are commercially licensed. The source code is available (you can read the compiled output on npm), but the license restricts redistribution and commercial use without a key.

Why AI specifically? Three reasons.

**It's the highest-value part of the stack.** AI agents that can manage your content, process payments, handle support tickets, and coordinate across services are genuinely transformative. This is where RevealUI stops being "another framework" and starts being an agentic business runtime.

**It's the most expensive to maintain.** Open-model inference evolves rapidly. Model formats change, quantization techniques improve, context windows expand, and new inference backends emerge. Maintaining reliable integrations across inference paths -- with memory systems, CRDT synchronization, and multi-agent coordination -- is a full-time job. Pro revenue funds this work directly.

**It's the clearest value boundary.** The line between "business primitives everyone needs" and "AI capabilities power users want" is clean. There's no ambiguity about what you're paying for.

Pro packages are published to npm as compiled distributions. You can install them, inspect the output, and verify what they do. We don't obfuscate the code or phone home. The license key unlocks the features; it doesn't enable surveillance.

---

## The Pricing Philosophy

| | Free (OSS) | Pro | Max | Forge (Enterprise) |
|---|---|---|---|---|
| **Price** | $0 | $49/mo | $149/mo | $299/mo |
| **Sites** | 1 | 5 | 15 | Unlimited |
| **Users/editors** | 3 | 25 | 100 | Unlimited |
| **Agent tasks/mo** | 1,000 | 10,000 | 50,000 | Unlimited |
| **API rate limit** | 200 req/min | 300 req/min | 600 req/min | 1,000 req/min |
| **Auth** | Session-based | Session-based | Session-based | Session + OAuth + SSO/SAML (planned) |
| **CMS collections** | Unlimited | Unlimited | Unlimited | Unlimited |
| **Real-time sync** | Basic | Full | Full | Full |
| **AI agents (open-model)** | -- | Yes | Yes | Yes |
| **AI memory** | -- | -- | Full (working + episodic + vector) | Full |
| **Advanced inference config** | -- | -- | Yes | Yes |
| **Stripe payments** | -- | Built-in | Built-in | Built-in |
| **Monitoring dashboard** | -- | Yes | Yes | Yes |
| **Custom domains** | -- | Yes | Yes | Yes |
| **Audit logging** | -- | -- | Yes | Yes |
| **Multi-tenant** | -- | -- | -- | Yes |
| **White-label** | -- | -- | -- | Yes (planned) |
| **Support** | Community | Email (48h) | Email (24h) | Slack (4h SLA) |
| **Source code** | Full | Full | Full | Full |

A few things worth noting about this table.

**The free tier is genuinely useful.** Unlimited CMS collections, session-based auth, basic real-time sync, 1,000 agent tasks per month, and full source code access. You can build and run a real product on the free tier. I don't want "free" to mean "demo."

**All four business primitives work on free.** Users, Content, Products, Payments -- the MIT core -- are fully functional at every tier. Free doesn't cripple the business stack to pressure upgrades. The tier boundaries are about scale (more sites, more users, higher rate limits) and AI capabilities.

**Pro will have a 7-day trial with no credit card required (coming soon).** The signup flow won't ask for payment information. You try it, you decide, you pay if it's worth it. If the product can't convince you in seven days, a payment wall on day one wasn't going to help.

### Three Pricing Tracks

Not everyone wants a subscription. We offer three ways to pay:

**Track A: Subscriptions** -- Monthly plans as shown above. Cancel anytime.

**Track B: Agent credits** -- Buy task bundles that never expire. Top up any plan when you need burst capacity. Three tiers: Starter (10,000 tasks), Standard (60,000 tasks, 17% cheaper per task), and Scale (350,000 tasks, 29% cheaper per task).

**Track C: Perpetual licenses** -- Pay once, use forever. Pro Perpetual, Agency Perpetual (up to 10 client deployments), and Forge Perpetual (unlimited self-hosted deployments). Each includes one year of priority support and all updates released during that year. After the year, the software keeps working -- you just stop getting new releases unless you renew support.

Perpetual licenses exist because some teams have procurement processes that can't handle subscriptions, and because "pay once, own it forever" is a model I personally respect.

**Early adopters get a discount.** Our first customers are taking a bet on a new product from a solo founder. That deserves recognition, not full price. Coupon codes will be available at launch for meaningful savings on the first year.

---

## The Economics of Open Source

Let me be direct about the risk I'm taking.

MIT means anyone can use everything without paying. A cloud provider could take RevealUI, host it as a managed service, charge money for it, and owe me nothing. A consultancy could fork it, rebrand it, and sell it as their own product. A competitor could copy the architecture and undercut me on price.

This is intentional. I'm not being naive about it -- I'm making a bet.

The bet is this: **most companies don't want to self-host and maintain production infrastructure.** Self-hosting is free, but "free" doesn't include the engineer-hours spent on database migrations, security patches, uptime monitoring, backup verification, and the hundred other operational tasks that come with running software in production.

What companies actually want is someone who maintains the software full-time, ships security patches promptly, provides a roadmap they can plan around, and answers the phone when something breaks. That's worth paying for, and that's what Pro provides.

The model works like this:

1. **Free primitives build adoption.** MIT-licensed business tools attract developers who need auth, content management, and payment processing. No friction, no signup, no sales call.

2. **Pro AI features convert power users.** Teams that outgrow the free tier -- more sites, more users, AI automation -- upgrade to Pro. The conversion happens because the product is genuinely more capable, not because we crippled the free version.

3. **Marketplace commissions create ecosystem revenue.** Developers publish MCP servers to our marketplace, set their own pricing, and earn 80% of revenue. We take 20% for hosting, discovery, and billing infrastructure. More developers building servers means more capability for agent users, which means more demand for agent tasks.

I'm not going to share revenue projections here. That's not the point. The point is transparency: here's exactly what's free, what's paid, and why. You can decide whether the trade-off makes sense for your team.

---

## The Ecosystem Play

RevealUI isn't just a framework you install. It's a platform with an ecosystem strategy.

**MCP Marketplace.** Developers can publish MCP servers -- tools that AI agents use to interact with external services -- with per-call pricing via the x402 payment protocol. Server authors earn 80% of revenue. We handle discovery, billing, and the agent routing infrastructure. The goal is a self-sustaining marketplace where developers build specialized integrations and get paid for their work.

**"Built with RevealUI" badge.** Completely opt-in. If you display the badge, you get 500 bonus agent tasks per month. If you don't want it, don't use it. We will never require attribution. MIT means MIT.

**Template marketplace.** Starter projects on Vercel that showcase RevealUI for specific use cases -- SaaS boilerplates, e-commerce setups, documentation sites, internal tools. These lower the barrier to getting started and demonstrate what's possible.

**Community on Discourse.** Free support for everyone through community forums. Pro and above get priority support with SLA-backed response times. The community is where we build trust, gather feedback, and help people succeed -- regardless of what tier they're on.

**The flywheel.** More developers using RevealUI means more MCP servers published to the marketplace. More MCP servers means agents can do more things. More capable agents means more demand for agent tasks. More demand means more developers building servers. Each layer reinforces the others.

This only works if the free tier is good enough that people actually adopt it. That's why the MIT core has to be genuinely useful, not a teaser.

---

## What We Won't Do

Commitments matter more when they're specific. Here's what we will not do:

**We won't paywall security features.** Authentication, rate limiting, encryption, brute force protection, CORS, CSP headers, RBAC -- these are part of the MIT core and they stay there. Security is not a premium feature. Every RevealUI deployment, free or paid, gets the same security stack.

**We won't add tracking or telemetry without consent.** RevealUI does not phone home. There are no analytics beacons, no usage tracking, no "anonymous" telemetry that ships data to our servers. If we ever add optional telemetry (for crash reporting, for example), it will be off by default and require explicit opt-in.

**We won't change the MIT license on existing code.** Code that's MIT today stays MIT forever. We might add new proprietary features in the future, but we will never relicense existing MIT code to something more restrictive. You can rely on that.

**We won't force upgrades.** Your version works forever. License keys don't expire (perpetual) or deactivate on downgrade (subscription -- you just lose access to Pro features, the software keeps running on the free tier). We don't have a kill switch and we won't build one.

**We won't sell user data.** We don't collect it. RevealUI runs on your infrastructure, connected to your database. We don't have access to your users' data, your content, or your transactions. The only data we store is your license key and account email.

---

## The Honest Version

Here's the part most launch posts skip.

I don't know if this model will work. MIT open source with a commercial AI tier is a bet that enough teams will find enough value in the Pro features to sustain a solo founder's business. Maybe they will. Maybe they won't. Maybe a cloud provider will host it for free and I'll need to find a different angle.

What I do know is that the alternative -- restrictive licensing, crippled free tiers, dark patterns in the upgrade flow -- might generate more short-term revenue but would make me build a product I don't want to use.

RevealUI is the business stack I wanted when I started building software companies. Users, content, products, payments, and AI -- pre-wired, open source, and ready to deploy. If it's useful to you at $0, that's a win. If it's useful enough to pay for, even better.

The code is on [GitHub](https://github.com/RevealUIStudio/revealui). The license is MIT. The Pro features will have a free trial (coming soon). Everything I've described in this post is verifiable.

Build something.

---

*RevealUI is an agentic business runtime. Learn more at [revealui.com](https://revealui.com) or read the [docs](https://docs.revealui.com).*
