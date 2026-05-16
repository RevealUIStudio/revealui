import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';
import { SetupForm } from './SetupForm';

/**
 * Server Component shell — must NOT be 'use client'.
 *
 * Reads `NEXT_PUBLIC_SITE_NAME` at request time to avoid the Next.js
 * client-bundle env-inlining bug: values read in 'use client' components
 * are baked in at build time, so Fleet kit deployments that set this var
 * at runtime would see the build-time default ("RevealUI") instead of
 * their kit-specific name.
 */
export default function SetupPage() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'RevealUI';

  return (
    <BrandedAuthLayout>
      <SetupForm siteName={siteName} />
    </BrandedAuthLayout>
  );
}
