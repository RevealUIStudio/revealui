import { getRestClient } from '@revealui/db/client';
import { getSiteContentActor } from '@revealui/db/queries/sites';
import { isPlatformSuperAdmin } from '@revealui/utils/validation';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPageReadContext } from '@/lib/cms/page-reader';
import { FulfillmentForm } from './FulfillmentForm';

export default async function ManageDeliveriesPage() {
  const { session, req } = await getPageReadContext();
  if (!(session && req.user)) notFound();
  const actor = await getSiteContentActor(getRestClient(), session.user.id);
  if (!isPlatformSuperAdmin(actor)) notFound();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/client-shares" className="underline">
        Client deliveries
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Manage consultation deliveries</h1>
      <p className="mt-3 text-zinc-600">
        Prepare notes for a verified paid booking, then publish the saved session. Sign in with MFA
        before using these controls.
      </p>
      <FulfillmentForm />
    </main>
  );
}
