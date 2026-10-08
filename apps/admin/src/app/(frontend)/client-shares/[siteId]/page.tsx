import { getExplicitDeploymentMode } from '@revealui/core/deployment-mode';
import type { Page as PageType } from '@revealui/core/types/admin';
import { getRestClient } from '@revealui/db/client';
import { getSiteById, getSiteContentActor } from '@revealui/db/queries/sites';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RenderBlocks } from '@/lib/blocks/RenderBlocks';
import { getPageReadContext, readPageCollection } from '@/lib/cms/page-reader';

export const metadata: Metadata = {
  title: 'Private consultation deliverables',
  robots: { index: false, follow: false },
};

export default async function ClientSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { session, req } = await getPageReadContext();
  if (!(session && req.user)) notFound();
  const db = getRestClient();
  const actor = await getSiteContentActor(db, session.user.id);
  if (!actor) notFound();
  const { siteId } = await params;
  const site = await getSiteById(db, siteId, {
    access: { actor, mode: getExplicitDeploymentMode() },
    clientShareBuyerUserId: session.user.id,
  });
  if (!site) notFound();
  const requestedPage = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const content = await readPageCollection({ siteId, publishedOnly: true, page, limit: 20 });
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/client-shares" className="underline underline-offset-4">
        Your deliverables
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">{site.name}</h1>
      {content.docs.map((document) => (
        <section key={document.id} className="mt-10 border-t pt-8">
          <h2 className="mb-6 text-2xl font-medium">{String(document.title ?? '')}</h2>
          {Array.isArray(document.blocks) && (
            <RenderBlocks blocks={document.blocks as unknown as PageType['blocks']} />
          )}
        </section>
      ))}
      {!content.docs.length && <p className="mt-8">No published content is available.</p>}
      {(content.hasPrevPage || content.hasNextPage) && (
        <nav aria-label="Content pages" className="mt-8 flex gap-6">
          {content.hasPrevPage && (
            <Link href={`/client-shares/${encodeURIComponent(siteId)}?page=${page - 1}`}>
              Previous
            </Link>
          )}
          {content.hasNextPage && (
            <Link href={`/client-shares/${encodeURIComponent(siteId)}?page=${page + 1}`}>Next</Link>
          )}
        </nav>
      )}
    </main>
  );
}
