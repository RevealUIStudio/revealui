import { getSession } from '@revealui/auth/server';
import type { RevealRequest } from '@revealui/core';
import type { Page as PageType } from '@revealui/core/types/admin';
import { logger } from '@revealui/utils/logger';
import type { Metadata } from 'next';
import { draftMode, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { isAdminRole } from '@/lib/access/roles/isAdminRole';
import { RenderBlocks } from '@/lib/blocks/RenderBlocks';
import { generateMeta } from '@/lib/cms/generateMeta';
import { RevealUIRedirects } from '@/lib/components/RevealUIRedirects';
import { extractRequestContext } from '@/lib/utils/request-context';
import { getRevealUIInstance } from '@/lib/utils/revealui-singleton';

// Force dynamic rendering to prevent build-time RevealUI admin initialization
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

// Auth-flow slugs are owned by dedicated route files (login/signup/mfa/…) or,
// in the case of `forgot-password`, by no route at all. This catch-all must
// never resolve a CMS page that claims one of them — otherwise a page authored
// with such a slug would impersonate the auth UI at an unauthenticated URL.
// `reset-password` and `setup` DO have real route files that shadow this
// catch-all, but they are listed for defence-in-depth so the deny-list is the
// complete reserved set regardless of future route-file changes.
//
// The guard is enforced inside queryPageBySlug (so generateMetadata is covered
// too); the render function additionally maps a reserved slug to notFound()
// rather than the redirects collection, which is allow-all and could itself
// map a reserved slug to an arbitrary destination.
const RESERVED_AUTH_SLUGS = new Set([
  'login',
  'signup',
  'mfa',
  'rotate-password',
  'forgot-password',
  'reset-password',
  'setup',
  // /dashboard has a dedicated static route in (backend)/dashboard/page.tsx.
  // Defense-in-depth: if routing priority ever changes, hard-404 here rather
  // than falling through to RevealUIRedirects with a reserved slug.
  'dashboard',
]);

// Removed generateStaticParams to prevent build-time initialization
// Pages will be generated on-demand at request time

export default async function Page({ params }: { params: Promise<{ slug?: string }> }) {
  const { slug = 'home' } = await params;
  const url = `/${slug}`;

  // A CMS page must never impersonate an auth-flow URL. Reserved slugs are
  // hard 404s here — not routed through the allow-all redirects collection.
  if (RESERVED_AUTH_SLUGS.has(slug)) {
    notFound();
  }

  const page = await queryPageBySlug({
    slug,
  });

  if (!page) {
    return <RevealUIRedirects url={url} />;
  }

  // Canonical-direct model: ALL page content (hero included, as the first
  // block) lives in the `blocks` array — there is no separate hero/layout.
  const { blocks } = page;

  return (
    <article className="pt-16 pb-24">
      {/* Allows redirects for valid pages too */}
      <RevealUIRedirects disableNotFound url={url} />

      {Array.isArray(blocks) && <RenderBlocks blocks={blocks as unknown as PageType['blocks']} />}
    </article>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string }>;
}): Promise<Metadata> {
  // During build, return minimal metadata to avoid database connections
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.POSTGRES_URL &&
    !process.env.DATABASE_URL
  ) {
    const { slug = 'home' } = await params;
    return { title: slug };
  }

  try {
    const { slug = 'home' } = await params;
    const page = await queryPageBySlug({
      slug,
    });
    return generateMeta({ doc: page });
  } catch {
    // If database isn't available, return minimal metadata
    const { slug = 'home' } = await params;
    return { title: slug };
  }
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  // Skip database queries during build
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
  if (isBuildTime) {
    return null;
  }

  // Reserved auth-flow slugs never resolve CMS content, on any entry point
  // (render OR generateMetadata).
  if (RESERVED_AUTH_SLUGS.has(slug)) {
    return null;
  }

  try {
    const { isEnabled: draft } = await draftMode();

    // Validate the session server-side. The proxy gate only checks cookie
    // PRESENCE (and trusts a client-set `revealui-role`); the render path must
    // not trust either. Draft / unpublished content is admin-only: only a real
    // session whose role is in the admin set builds a user-bearing `req` and
    // enables draft mode. Every other caller — anonymous, forged-cookie, or a
    // non-admin (e.g. public-signup `user`) session — gets a user-LESS `req`
    // so the collection's `authenticatedOrPublished` rule yields the
    // published-only filter (NOT deny-all: passing `undefined` would trip
    // find()'s `if (!req) return false` and 404 every public page).
    const hdrs = await headers();
    const requestContext = extractRequestContext(
      new Request('http://localhost', { headers: hdrs }),
    );
    const session = await getSession(hdrs, requestContext);
    const isAdmin = Boolean(session) && isAdminRole(session?.user.role);

    const req: RevealRequest =
      isAdmin && session
        ? {
            user: {
              id: session.user.id,
              email: session.user.email ?? '',
              roles: [session.user.role],
            },
          }
        : {};

    const revealui = await getRevealUIInstance();

    const result = await revealui.find({
      collection: 'pages',
      draft: draft && isAdmin,
      limit: 1,
      req,
      where: {
        slug: {
          equals: slug,
        },
      },
    });

    return result.docs?.[0] || null;
  } catch (error) {
    logger.error(
      '[RevealUI] Error fetching page',
      error instanceof Error ? error : new Error(String(error)),
      {
        slug,
      },
    );
    return null;
  }
});
