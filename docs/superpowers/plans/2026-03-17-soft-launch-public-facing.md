# Soft Launch — Public-Facing Strategy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the soft launch changes by Friday 2026-03-21 — CTA pivot from waitlist to signup, CMS login gate, "Built with RevealUI" badge, and AGENTS.md update.

**Architecture:** Three independent work streams (marketing site CTAs, CMS login gate, badge component) that can be built in parallel. Blog is a stretch goal — defer to hard launch if not ready.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, `@revealui/presentation` CVA components, `@revealui/core/richtext/rsc` for Lexical rendering, Hono API.

**Spec:** `docs/superpowers/specs/2026-03-17-public-facing-strategy-design.md`

---

## File Map

### Marketing (`apps/marketing/`)
| Action | File | Responsibility |
|--------|------|---------------|
| DELETE | `src/components/LeadCapture.tsx` | Old waitlist form |
| CREATE | `src/components/GetStarted.tsx` | New CTA block linking to signup |
| MODIFY | `src/components/HeroSection.tsx` | Update primary CTA text + target |
| MODIFY | `src/components/NavBar.tsx` | Add Blog, Login links; update CTA |
| MODIFY | `src/app/page.tsx` | Swap LeadCapture → GetStarted |
| MODIFY | `src/app/api/waitlist/route.ts` | Return 301 redirect |
| CREATE | `src/app/blog/page.tsx` | Blog index (stretch) |
| CREATE | `src/app/blog/[slug]/page.tsx` | Post page (stretch) |
| CREATE | `src/lib/blog.ts` | API fetch + cache helpers (stretch) |

### CMS (`apps/cms/`)
| Action | File | Responsibility |
|--------|------|---------------|
| DELETE | `src/lib/components/CmsLandingPage.tsx` | Old marketing landing page |
| MODIFY | `src/app/(frontend)/page.tsx` | Redirect to /login |
| MODIFY | `src/app/(frontend)/login/page.tsx` | Add branding to auth layout |
| MODIFY | `src/app/(frontend)/posts/page.tsx` | 301 redirect to revealui.com/blog |
| MODIFY | `src/app/(frontend)/posts/[slug]/page.tsx` | 301 redirect |
| MODIFY | `src/app/(frontend)/posts/page/[pageNumber]/page.tsx` | 301 redirect |

### Packages
| Action | File | Responsibility |
|--------|------|---------------|
| CREATE | `packages/presentation/src/components/BuiltWithRevealUI.tsx` | Badge component |

### Root
| Action | File | Responsibility |
|--------|------|---------------|
| MODIFY | `AGENTS.md` | Update capabilities + discovery URLs |

---

## Task 1: Marketing — CTA Pivot (Homepage)

**Files:**
- Delete: `apps/marketing/src/components/LeadCapture.tsx`
- Create: `apps/marketing/src/components/GetStarted.tsx`
- Modify: `apps/marketing/src/app/page.tsx`
- Modify: `apps/marketing/src/components/HeroSection.tsx:86-89`

- [ ] **Step 1: Create GetStarted component**

Create `apps/marketing/src/components/GetStarted.tsx` — a simple CTA section replacing the waitlist. Dark background (matching the old LeadCapture's `bg-gray-950`), centered heading "Ready to build?", subtext, and a "Get Started Free" button linking to `cms.revealui.com/signup`.

Use `ButtonCVA` from `@revealui/presentation`. Keep it simple — no form, no email input. Reference the styling patterns in `LeadCapture.tsx` for spacing/colors but remove all form logic.

- [ ] **Step 2: Update homepage to use GetStarted**

In `apps/marketing/src/app/page.tsx`:
- Replace `import { LeadCapture }` with `import { GetStarted }`
- Replace `<LeadCapture />` with `<GetStarted />`

- [ ] **Step 3: Update HeroSection primary CTA**

In `apps/marketing/src/components/HeroSection.tsx` line 88:
- Change `<a href="#waitlist">Get Early Access</a>` to `<a href="https://cms.revealui.com/signup">Get Started Free</a>`

- [ ] **Step 4: Update trust signals in SocialProof**

In `apps/marketing/src/components/SocialProof.tsx`, update any hardcoded stats to current values:
- Test count: 5,606
- Workspace count: 24
- Any other stale numbers

- [ ] **Step 5: Delete LeadCapture**

Delete `apps/marketing/src/components/LeadCapture.tsx`.

- [ ] **Step 6: Verify marketing site builds**

Run: `pnpm --filter marketing build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/marketing/src/components/GetStarted.tsx apps/marketing/src/components/HeroSection.tsx apps/marketing/src/app/page.tsx
git rm apps/marketing/src/components/LeadCapture.tsx
git commit -m "feat(marketing): pivot CTAs from waitlist to signup"
```

---

## Task 2: Marketing — NavBar Update

**Files:**
- Modify: `apps/marketing/src/components/NavBar.tsx`

- [ ] **Step 1: Update navLinks array**

In `apps/marketing/src/components/NavBar.tsx` line 7-11, add Blog link:
```ts
const navLinks = [
  { label: 'Docs', href: 'https://docs.revealui.com' },
  { label: 'Blog', href: '/blog' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Sponsor', href: '/sponsor' },
];
```

- [ ] **Step 2: Update desktop CTA button**

In `NavBar.tsx` around line 49-51, change:
- `<a href="/#waitlist">Get Early Access</a>` → `<a href="https://cms.revealui.com/signup">Get Started</a>`

- [ ] **Step 3: Add Login link before the CTA**

Add a text link before the CTA button in the desktop nav:
```tsx
<a
  href="https://cms.revealui.com/login"
  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
>
  Log in
</a>
```

- [ ] **Step 4: Update mobile menu**

Ensure the mobile menu (hamburger) also has the updated links: Blog, Login, and "Get Started" button with the new target.

- [ ] **Step 5: Verify build**

Run: `pnpm --filter marketing build`
Expected: Succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/components/NavBar.tsx
git commit -m "feat(marketing): update nav with blog, login, signup links"
```

---

## Task 3: Marketing — Waitlist Endpoint Redirect

**Files:**
- Modify: `apps/marketing/src/app/api/waitlist/route.ts`

- [ ] **Step 1: Replace POST handler with redirect**

Replace the entire file content. GET returns 301 (permanent redirect for browsers/crawlers). POST returns 410 Gone with a JSON message (since POST redirects are unreliable across clients):

```ts
import { NextResponse } from 'next/server';

/** Waitlist closed — redirect to signup. Kept for external link compatibility. */
export function GET() {
  return NextResponse.redirect('https://cms.revealui.com/signup', 301);
}

export function POST() {
  return NextResponse.json(
    { message: 'Waitlist closed. Sign up at https://cms.revealui.com/signup' },
    { status: 410 },
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter marketing build`

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/app/api/waitlist/route.ts
git commit -m "chore(marketing): redirect waitlist endpoint to signup"
```

---

## Task 4: CMS — Login Gate (Replace Landing Page)

**Files:**
- Modify: `apps/cms/src/app/(frontend)/page.tsx`
- Delete: `apps/cms/src/lib/components/CmsLandingPage.tsx`

- [ ] **Step 1: Update CMS root route**

Replace `apps/cms/src/app/(frontend)/page.tsx` with:

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('revealui-session');

  if (sessionCookie?.value) {
    redirect('/admin');
  }

  redirect('/login');
}
```

- [ ] **Step 2: Delete CmsLandingPage**

Delete `apps/cms/src/lib/components/CmsLandingPage.tsx`.

- [ ] **Step 3: Verify CMS builds**

Run: `pnpm --filter cms build`
Expected: Build succeeds. The CmsLandingPage import is gone, no dangling references.

- [ ] **Step 4: Commit**

```bash
git rm apps/cms/src/lib/components/CmsLandingPage.tsx
git add apps/cms/src/app/\(frontend\)/page.tsx
git commit -m "feat(cms): replace landing page with login gate redirect"
```

---

## Task 5: CMS — Auth Page Branding

**Files:**
- Modify: `packages/presentation/src/components/auth-layout.tsx` (shared AuthLayout component)

Branding goes on `AuthLayout` (not individual login page) so all auth pages are consistent: login, signup, reset-password, MFA.

- [ ] **Step 1: Read AuthLayout**

Read `packages/presentation/src/components/auth-layout.tsx` to understand the current layout structure. If it doesn't exist at that path, search for `AuthLayout` in the presentation package and CMS app.

- [ ] **Step 2: Add branding to AuthLayout**

Add above the auth form slot:
- RevealUI logo image (`<img src="/logo.webp" alt="RevealUI" />` or import the asset)
- "Business OS Software" text below logo (text-sm, text-gray-500)
- Keep it minimal — logo + one line, centered

Add below the auth form slot:
- "Learn more at revealui.com" link (text-xs, text-gray-400, external link)

- [ ] **Step 3: Verify all auth pages render with branding**

Run: `pnpm --filter cms build`
Manually check: `/login`, `/signup`, `/reset-password` all show the logo and one-liner.

- [ ] **Step 4: Commit**

```bash
git add packages/presentation/src/components/auth-layout.tsx
git commit -m "feat(presentation): add RevealUI branding to AuthLayout"
```

---

## Task 6: CMS — Blog Route Redirects

**Files:**
- Modify: `apps/cms/src/app/(frontend)/posts/page.tsx`
- Modify: `apps/cms/src/app/(frontend)/posts/[slug]/page.tsx`
- Modify: `apps/cms/src/app/(frontend)/posts/page/[pageNumber]/page.tsx`

- [ ] **Step 1: Add 301 redirect to posts index**

Replace the content of `apps/cms/src/app/(frontend)/posts/page.tsx` with:

```tsx
import { permanentRedirect } from 'next/navigation';

export default function PostsRedirect() {
  permanentRedirect('https://revealui.com/blog');
}
```

Note: `permanentRedirect()` returns HTTP 308 (Permanent Redirect, preserves method). This is the Next.js standard for permanent redirects and transfers SEO authority correctly.

- [ ] **Step 2: Add 301 redirect to post slug page**

Replace `apps/cms/src/app/(frontend)/posts/[slug]/page.tsx` with:

```tsx
import { permanentRedirect } from 'next/navigation';

export default async function PostRedirect({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`https://revealui.com/blog/${slug}`);
}
```

- [ ] **Step 3: Add 301 redirect to paginated posts**

Replace `apps/cms/src/app/(frontend)/posts/page/[pageNumber]/page.tsx` with:

```tsx
import { permanentRedirect } from 'next/navigation';

export default function PaginatedPostsRedirect() {
  permanentRedirect('https://revealui.com/blog');
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter cms build`

- [ ] **Step 5: Commit**

```bash
git add apps/cms/src/app/\(frontend\)/posts/
git commit -m "feat(cms): redirect blog routes to marketing site"
```

---

## Task 7: "Built with RevealUI" Badge Component

**Files:**
- Create: `packages/presentation/src/components/BuiltWithRevealUI.tsx`

- [ ] **Step 1: Create the badge component**

Create `packages/presentation/src/components/BuiltWithRevealUI.tsx`:

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn.js';

const badgeStyles = cva(
  'inline-flex items-center gap-1.5 rounded-md border text-xs font-medium transition-opacity hover:opacity-100',
  {
    variants: {
      size: {
        sm: 'px-2 py-1 text-[10px]',
        md: 'px-2.5 py-1.5 text-xs',
      },
      position: {
        'bottom-right': 'fixed bottom-4 right-4 z-40',
        'bottom-left': 'fixed bottom-4 left-4 z-40',
        'bottom-center': 'fixed bottom-4 left-1/2 -translate-x-1/2 z-40',
        inline: '',
      },
    },
    defaultVariants: {
      size: 'sm',
      position: 'inline',
    },
  },
);

interface BuiltWithRevealUIProps extends VariantProps<typeof badgeStyles> {
  variant?: 'full' | 'logo';
  className?: string;
}

export function BuiltWithRevealUI({
  size,
  position,
  variant = 'full',
  className,
}: BuiltWithRevealUIProps) {
  return (
    <a
      href="https://revealui.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        badgeStyles({ size, position }),
        'border-gray-200 bg-white/90 text-gray-500 opacity-75 backdrop-blur-sm',
        'dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-400',
        'no-underline hover:no-underline',
        className,
      )}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="4" fill="currentColor" fillOpacity="0.15" />
        <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700">
          R
        </text>
      </svg>
      {variant === 'full' && <span>Built with RevealUI</span>}
    </a>
  );
}
```

Note: The SVG logo mark is a placeholder — replace with the actual RevealUI logo SVG when available. The component is theme-aware via `dark:` variants.

- [ ] **Step 2: Export from presentation barrel**

Add the export to `packages/presentation/src/components/index.ts` (where all other components are exported from):

```ts
export { BuiltWithRevealUI } from './BuiltWithRevealUI.js';
```

- [ ] **Step 3: Verify presentation builds**

Run: `pnpm --filter @revealui/presentation build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/presentation/src/components/BuiltWithRevealUI.tsx packages/presentation/src/index.ts
git commit -m "feat(presentation): add BuiltWithRevealUI badge component"
```

---

## Task 8: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md` (repo root)

- [ ] **Step 1: Read current AGENTS.md**

Read the existing file to understand its structure and content.

- [ ] **Step 2: Update capabilities section**

Ensure these are documented:
- Five primitives (Users, Content, Products, Payments, Intelligence)
- REST API at `api.revealui.com` with OpenAPI spec at `/openapi.json`
- A2A Agent Card at `/.well-known/agent.json`
- MCP servers available: Stripe, Supabase, Neon, Vercel, Code Validator, Playwright, Next.js DevTools
- x402 payment support for marketplace
- License tiers: free (MIT), pro, max, enterprise

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with current capabilities"
```

---

## Task 9 (STRETCH): Marketing — Blog Route

Only attempt if Tasks 1-8 are complete and there is time before Friday.

**Files:**
- Create: `apps/marketing/src/lib/blog.ts`
- Create: `apps/marketing/src/app/blog/page.tsx`
- Create: `apps/marketing/src/app/blog/[slug]/page.tsx`

- [ ] **Step 1: Create blog API helper**

Create `apps/marketing/src/lib/blog.ts`:

```ts
const API_URL = process.env.API_URL || 'https://api.revealui.com';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: unknown;
  publishedAt: string | null;
  createdAt: string;
  _json?: Record<string, unknown>;
}

interface PaginatedResult {
  docs: BlogPost[];
  totalDocs: number;
  totalPages: number;
  page: number;
}

export async function getPosts(page = 1, limit = 12): Promise<PaginatedResult> {
  const res = await fetch(`${API_URL}/api/posts?page=${page}&limit=${limit}`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return { docs: [], totalDocs: 0, totalPages: 0, page: 1 };
  }

  return res.json();
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const res = await fetch(`${API_URL}/api/posts/slug/${encodeURIComponent(slug)}`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) return null;

  return res.json();
}
```

- [ ] **Step 2: Create blog index page**

Create `apps/marketing/src/app/blog/page.tsx` using the fetch helper. Display posts as a card grid. If no posts, show "No posts yet — check back soon." with a link back to the homepage.

Use ISR: `export const revalidate = 300;`

Generate metadata: `title: 'Blog — RevealUI'`, `description: 'Updates, guides, and insights from the RevealUI team.'`

- [ ] **Step 3: Create blog post page**

Create `apps/marketing/src/app/blog/[slug]/page.tsx`. Fetch by slug. Render Lexical content using `serializeLexicalState` from `@revealui/core/richtext/rsc`. If post not found, call `notFound()`.

Generate dynamic metadata from post title and description fields.

- [ ] **Step 4: Verify build**

Run: `pnpm --filter marketing build`

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/lib/blog.ts apps/marketing/src/app/blog/
git commit -m "feat(marketing): add blog routes fetching from CMS API"
```

---

## Pre-Launch Verification (Friday Morning)

- [ ] Run full gate: `pnpm gate`
- [ ] Visit `revealui.com` — verify "Get Started Free" CTA links to `cms.revealui.com/signup`
- [ ] Visit `revealui.com` — verify "Log in" link in nav works
- [ ] Visit `cms.revealui.com` without session — verify redirect to `/login`
- [ ] Visit `cms.revealui.com/login` — verify branding (logo, one-liner, "Learn more" link)
- [ ] Visit `cms.revealui.com` with session — verify redirect to `/admin`
- [ ] Visit `cms.revealui.com/posts` — verify 301 to `revealui.com/blog`
- [ ] Complete signup flow: signup → verify email → login → admin dashboard
- [ ] Verify pricing page loads with Stripe prices
- [ ] If blog shipped: verify `revealui.com/blog` renders posts (or graceful empty state)
- [ ] Verify `BuiltWithRevealUI` component renders in light + dark themes
