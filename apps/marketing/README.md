# RevealUI Marketing Site

Marketing site for RevealUI  -  agentic business runtime. Users, content, products, payments, and AI, pre-wired and open source.

**Tagline:** "Build your business, not your boilerplate."

## What's here

- Hero: "Build your business, not your boilerplate." + five primitives subtitle
- ValueProposition: "Stop stitching tools together"  -  Own Your Stack, AI Agents Built In, Production Stack Included
- SocialProof: six capability cards
- LeadCapture: waitlist form (posts to RevealUI API; storage and email handled server-side via Gmail API)
- ProductMockup: illustrated browser chrome of the admin UI

## Development

```bash
pnpm dev        # Start dev server (port 3000)
pnpm build      # Production build
pnpm typecheck  # TypeScript check
```

## Deployment

Auto-deploys to Vercel on push to `main` (project: `revealui-marketing`).
The ignoreCommand skips builds when no `apps/marketing/**` files changed.

## Environment Variables

The marketing site has no server-side secrets  -  it proxies form submissions to the RevealUI API, which handles storage and email.

```env
NEXT_PUBLIC_API_URL=     # RevealUI API base (default: https://api.revealui.com)
NEXT_PUBLIC_ADMIN_URL=   # RevealUI admin URL (default: https://admin.revealui.com)
```

## API

- `POST /api/waitlist`  -  Proxies waitlist signup to the RevealUI API (rate-limited; API handles storage + email)
- `GET /api/waitlist`  -  410 Gone (removed for GDPR)

## Routes

- `/`  -  Landing page
- `/pricing`  -  Pro/Forge pricing and commercial packaging
- `/sponsor`  -  Sponsorship tiers
- `/privacy`  -  Privacy policy
- `/terms`  -  Terms of service

## Commercial framing

The marketing site should present RevealUI as:

- platform software sold at the account or workspace level
- metered agent execution for automation and paid AI work
- optional commerce-linked fees where RevealUI participates in transactions
- premium trust and governance controls for approval, audit, and compliance needs

## Key Components

- `src/components/HeroSection.tsx`  -  Headline + CTA + ProductMockup
- `src/components/ProductMockup.tsx`  -  Illustrated admin UI (browser chrome)
- `src/components/ValueProposition.tsx`  -  Three-column feature section
- `src/components/SocialProof.tsx`  -  Six capability cards
- `src/components/LeadCapture.tsx`  -  Waitlist form
- `src/components/Footer.tsx`  -  Footer with nav links
