import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';
import { SignupForm } from './SignupForm';

/**
 * Server Component shell — must NOT be 'use client'.
 *
 * Reads `NEXT_PUBLIC_API_URL` at request time so Fleet kit deployments that
 * override the env var get the correct value at runtime rather than the
 * value inlined at build time.  Passes the resolved URL down to the Client
 * form component via props.
 */
export default function SignupPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com';

  return (
    <BrandedAuthLayout>
      <SignupForm apiUrl={apiUrl} />
    </BrandedAuthLayout>
  );
}
