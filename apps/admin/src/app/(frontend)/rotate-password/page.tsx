import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';
import { RotatePasswordForm } from './RotatePasswordForm';

/**
 * Server Component shell — must NOT be 'use client'.
 *
 * No env reads are needed here; BrandedAuthLayout handles tenant branding
 * server-side.  The shell keeps this page out of the client bundle so
 * BrandedAuthLayout's env reads happen at request time.
 */
export default function RotatePasswordPage() {
  return (
    <BrandedAuthLayout>
      <RotatePasswordForm />
    </BrandedAuthLayout>
  );
}
