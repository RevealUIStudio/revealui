import { isRecoverySession } from '@revealui/auth/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getPageReadContext } from '@/lib/cms/page-reader';
import { buildAuthIntentQuery } from '@/lib/utils/auth-redirect';
import { safePostAuthRedirect } from '@/lib/utils/safe-internal-redirect';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ClientShareLayout({ children }: { children: ReactNode }) {
  const { session } = await getPageReadContext();
  const pathname = (await headers()).get('x-revealui-pathname') ?? '/client-shares';
  const returnPath = safePostAuthRedirect(pathname) ?? '/client-shares';
  if (session && (isRecoverySession(session) || session.user.mustRotatePassword)) {
    redirect(`/rotate-password${buildAuthIntentQuery({ upgrade: null, redirect: returnPath })}`);
  }
  if (!session) {
    redirect(`/login${buildAuthIntentQuery({ upgrade: null, redirect: returnPath })}`);
  }
  return children;
}
