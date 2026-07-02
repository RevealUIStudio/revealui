import { getSession } from '@revealui/auth/server';
import type { RevealRequest } from '@revealui/core';
import type { Page as PageType } from '@revealui/core/types/admin';
import { logger } from '@revealui/utils/logger';
import type { Metadata } from 'next';
import { draftMode, headers } from 'next/headers';
import { cache } from 'react';
import { RenderBlocks } from '@/lib/blocks/RenderBlocks';
import { generateMeta } from '@/lib/cms/generateMeta';
import { RevealUIRedirects } from '@/lib/components/RevealUIRedirects';
import { RenderHero } from '@/lib/heros/RenderHero';
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
const RESERVED_AUTH_SLUGS = new Set([
  'login',
  'signup',
  'mfa',
  'rotate-password',
  'forgot-password',
  'reset-password',
  'setup',
]);

// Removed generateStaticParams to prevent build-time initialization
// Pages will be generated on-demand at request time

export default async function Page({ params }: { params: Promise<{ slug?: string }> }) {
  const { slug = 'home' } = await params;
  const url = `/${slug}`;

  // A CMS page must never impersonate an auth-flow URL.
  if (RESERVED_AUTH_SLUGS.has(slug)) {
    return <RevealUIRedirects url={url} />;
  }

  const page = await queryPageBySlug({
    slug,
  });

  if (!page) {
    return <RevealUIRedirects url={url} />;
  }

  const { hero, layout } = page;

  return (
    <article className="pt-16 pb-24">
      {/* Allows redirects for valid pages too */}
      <RevealUIRedirects disableNotFound url={url} />

      {hero && <RenderHero {...(hero as Parameters<typeof RenderHero>[0])} />}
      {layout && Array.isArray(layout) && (
        <RenderBlocks blocks={layout as unknown as PageType['layout']} />
      )}
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

  try {
    const { isEnabled: draft } = await draftMode();

    // Validate the session server-side. The proxy gate only checks cookie
    // PRESENCE; the render path must not trust that. A valid session admits
    // the caller to draft/unpublished content via the collection's
    // `authenticatedOrPublished` access rule; an anonymous (or forged-cookie)
    // request resolves to a null user and sees PUBLISHED content only.
    // Draft preview is likewise gated on a real session, so toggling the
    // draft-mode cookie without authenticating cannot surface drafts.
    const session = await getSession(await headers());
    const req: RevealRequest | undefined = session
      ? {
          user: {
            id: session.user.id,
            email: session.user.email ?? '',
            roles: [session.user.role],
          },
        }
      : undefined;

    const revealui = await getRevealUIInstance();

    const result = await revealui.find({
      collection: 'pages',
      draft: draft && Boolean(session),
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
