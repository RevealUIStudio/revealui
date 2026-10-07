import type { Page as PageType } from '@revealui/core/types/admin';
import { logger } from '@revealui/utils/logger';
import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { RenderBlocks } from '@/lib/blocks/RenderBlocks';
import { generateMeta } from '@/lib/cms/generateMeta';
import { readPageCollection } from '@/lib/cms/page-reader';
import { RevealUIRedirects } from '@/lib/components/RevealUIRedirects';

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
  'client-shares',
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

    // Every real session reaches the canonical site/page ACL. A draft cookie
    // does not confer site editor authority; viewers remain published-only.
    const result = await readPageCollection({
      slug,
      draft,
      limit: 1,
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
