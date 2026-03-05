# RevealUI Marketing Site

Marketing and waitlist site for RevealUI — open-source business infrastructure for software companies.

**Tagline:** "Build your business, not your boilerplate."

## What's here

- Hero: "Build your business, not your boilerplate." + five primitives subtitle
- ValueProposition: "Stop stitching tools together" — Own Your Stack, AI Agents Built In, Production Stack Included
- SocialProof: six capability cards
- LeadCapture: waitlist form with DB-backed storage and Resend email notifications
- ProductMockup: illustrated browser chrome of the CMS admin UI

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

```env
RESEND_API_KEY=          # Waitlist founder notification emails (Resend)
DATABASE_URL=            # NeonDB connection string (waitlist storage)
```

## API

- `POST /api/waitlist` — Add email to waitlist (DB-backed, rate-limited, Resend notification)
- `GET /api/waitlist` — 410 Gone (removed for GDPR)

## Routes

- `/` — Landing page
- `/pricing` — Pro/Enterprise pricing tiers
- `/sponsor` — Sponsorship tiers
- `/privacy` — Privacy policy
- `/terms` — Terms of service

## Key Components

- `src/components/HeroSection.tsx` — Headline + CTA + ProductMockup
- `src/components/ProductMockup.tsx` — Illustrated CMS admin UI (browser chrome)
- `src/components/ValueProposition.tsx` — Three-column feature section
- `src/components/SocialProof.tsx` — Six capability cards
- `src/components/LeadCapture.tsx` — Waitlist form
- `src/components/Footer.tsx` — Footer with nav links
