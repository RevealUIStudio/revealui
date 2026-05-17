import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';
import { ResetPasswordForm } from './ResetPasswordForm';

/**
 * Server Component shell — must NOT be 'use client'.
 *
 * No env reads are needed here; BrandedAuthLayout handles tenant branding
 * server-side.  The shell exists to keep this page out of the client bundle
 * so `BrandedAuthLayout`'s env reads happen at request time.
 */
export default function ResetPasswordPage() {
  return (
    <BrandedAuthLayout>
      <ResetPasswordForm />
    </BrandedAuthLayout>
  );
}
