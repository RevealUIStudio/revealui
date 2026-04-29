# agency

RevealUI Studio agency site. Hosted at [revealuistudio.com](https://revealuistudio.com).

This is the customer-facing site for the **agency arm** (services, case studies, hire-us). It is distinct from `apps/marketing` (which is the **product** site at revealui.com promoting the open-source RevealUI platform itself).

## Brand surfaces

| Site | App | Audience | Role |
|---|---|---|---|
| revealui.com | `apps/marketing` | Engineers evaluating the OSS platform | Convince them to install + adopt |
| revealuistudio.com | `apps/agency` *(this app)* | B2B buyers evaluating an agency | Convince them to book a discovery call + sign |
| docs.revealui.com | `apps/docs` | Existing platform users | Reference + how-to |

## Stack

Identical to `apps/marketing` (dogfooded RevealUI):

- Vite + React 19
- TypeScript (strict)
- Tailwind CSS via `@tailwindcss/vite`
- `@revealui/router` (file-based routing)
- `@revealui/presentation` (component primitives + tokens)
- `@revealui/core`, `@revealui/contracts` (workspace internals)
- `@vercel/speed-insights` (analytics)
- Vitest for testing

## Routes (Phase 1)

| Path | Component | Status |
|---|---|---|
| `/` | `HomePage` | Hero + service teasers + engagement framing |
| `/services` | `ServicesPage` | Productized tiers (Forge Stamp / Custom Build / AI Integration) |
| `/about` | `AboutPage` | Founder bio + Suite overview |
| `/contact` | `ContactPage` | Email-only placeholder; full form ships in Phase 2 |
| `/*notfound` | `NotFoundPage` | — |

## Development

```bash
# From the monorepo root
pnpm install
pnpm --filter agency dev  # runs on port 3001 (marketing is 3000)

# Or from this directory
pnpm dev
```

## Build

```bash
pnpm --filter agency build
```

## Deploy

Vercel project should be configured separately from `marketing`:

- **Build command:** auto-detected via `vercel.json` (`cd ../.. && pnpm --filter agency run vercel-build`)
- **Output:** `apps/agency/dist`
- **Domain:** `revealuistudio.com`
- **DNS:** Namecheap registrar; A record at apex pointing to Vercel (`76.76.21.21`); CNAME for `www` to `cname.vercel-dns.com`

See `~/suite/.jv/docs/agency-site-strategy.md` for the full strategy + phased plan.

## Phase plan

| Phase | What ships | Status |
|---|---|---|
| **1** | Scaffold + Hero + service teasers + placeholder routes; deploy to revealuistudio.com | this PR |
| **2** | Full service detail pages, founder bio with photo, real ContactForm wired to API, Cal.com booking | next |
| **3** | First case study (Allevia, after deal close + permission); case study template | post-Allevia |
| **4** | Blog / content marketing | as needed |
| **5** | SEO polish, OG images, sitemap, structured data | ongoing |

## Conventions

- **Brand identity is fully shared with RevealUI** — same Tailwind tokens (`@revealui/presentation/tokens.css`), same Geist font stack, same emerald accent. Visual continuity signals "same team."
- **Cross-link to revealui.com** prominently (NavBar external link + Footer "Powered by RevealUI" badge). Customers should easily discover the OSS platform underneath.
- **No "L.L.C." in any user-facing copy** except the legal-form footer line — brand surface is `RevealUI Studio`, not `RevealUI Studio L.L.C.`.
