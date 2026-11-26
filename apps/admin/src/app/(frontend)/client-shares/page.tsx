import { getExplicitDeploymentMode } from '@revealui/core/deployment-mode';
import { getRestClient } from '@revealui/db/client';
import { countSites, getAllSites, getSiteContentActor } from '@revealui/db/queries/sites';
import { isPlatformSuperAdmin } from '@revealui/utils/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPageReadContext } from '@/lib/cms/page-reader';

export const metadata: Metadata = {
  title: 'Your consultation deliverables',
  robots: { index: false, follow: false },
};

export default async function ClientSharesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { session, req } = await getPageReadContext();
  if (!(session && req.user)) notFound();
  const db = getRestClient();
  const actor = await getSiteContentActor(db, session.user.id);
  if (!actor) notFound();
  const requestedPage = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = 20;
  const scope = {
    access: { actor, mode: getExplicitDeploymentMode() },
    clientShareBuyerUserId: session.user.id,
  };
  const [shares, total] = await Promise.all([
    getAllSites(db, { ...scope, limit, offset: (page - 1) * limit }),
    countSites(db, scope),
  ]);
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Your consultation deliverables</h1>
      <p className="mt-3 text-zinc-600">Private content shared with your account.</p>
      {isPlatformSuperAdmin(actor) && (
        <Link href="/client-shares/manage" className="mt-4 inline-block underline">
          Manage deliveries
        </Link>
      )}
      {shares.length ? (
        <ul className="mt-8 grid gap-4">
          {shares.map((site) => (
            <li key={site.id} className="rounded-lg border p-5">
              <Link
                href={`/client-shares/${encodeURIComponent(site.id)}`}
                className="text-lg font-medium underline underline-offset-4"
              >
                {site.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8">Your published deliverables will appear here once they’re ready.</p>
      )}
      {(page > 1 || page * limit < total) && (
        <nav aria-label="Deliverables pages" className="mt-8 flex gap-6">
          {page > 1 && <Link href={`/client-shares?page=${page - 1}`}>Previous</Link>}
          {page * limit < total && <Link href={`/client-shares?page=${page + 1}`}>Next</Link>}
        </nav>
      )}
    </main>
  );
}
