'use client';

import { useMFAVerify } from '@revealui/auth/react';
import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormLabel,
  InputCVA as Input,
} from '@revealui/presentation/server';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';

export default function MFAPage() {
  const router = useRouter();
  const { verify, verifyBackupCode, isLoading, error } = useMFAVerify();
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const displayError = formError ?? error;
  const isRateLimited = displayError?.toLowerCase().includes('rate');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim()) {
      setFormError(
        useBackupCode ? 'Please enter a backup code' : 'Please enter your verification code',
      );
      return;
    }

    const success = useBackupCode ? await verifyBackupCode(code.trim()) : await verify(code.trim());

    if (success) {
      router.push('/admin');
    }
  };

  return (
    <BrandedAuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{useBackupCode ? 'Enter backup code' : 'Two-factor authentication'}</CardTitle>
          <CardDescription>
            {useBackupCode
              ? 'Enter one of the backup codes you saved when setting up two-factor authentication.'
              : 'Enter the 6-digit code from your authenticator app to continue.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {isRateLimited
                  ? 'Too many attempts. Please wait a moment and try again.'
                  : displayError}
              </div>
            )}

            {useBackupCode ? (
              <div className="space-y-2">
                <FormLabel htmlFor="backup-code" required>
                  Backup code
                </FormLabel>
                <Input
                  id="backup-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={isLoading}
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="xxxx-xxxx-xxxx"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <FormLabel htmlFor="totp-code" required>
                  Verification code
                </FormLabel>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  required
                />
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Verifying...' : 'Verify'}
            </Button>

            <div className="flex flex-col items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setCode('');
                  setFormError(null);
                }}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code instead'}
              </button>

              <Link href="/login" className="text-zinc-600 hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </BrandedAuthLayout>
  );
}
