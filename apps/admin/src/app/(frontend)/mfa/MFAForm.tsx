'use client';

import { useMFAVerify } from '@revealui/auth/react';
import {
  ButtonCVA as Button,
  FormLabel,
  Heading,
  InputCVA as Input,
} from '@revealui/presentation/server';
import Link from 'next/link';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { navigateAfterAuthChange } from '@/lib/utils/auth-navigation';

function filterDigits(value: string): string {
  return [...value].filter((c) => c >= '0' && c <= '9').join('');
}

export function MFAForm() {
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
      navigateAfterAuthChange('/');
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <Heading as="h2" size="lg" className="tracking-tight">
        {useBackupCode ? 'Enter backup code' : 'Two-factor authentication'}
      </Heading>

      <p className="text-sm text-muted-foreground">
        {useBackupCode
          ? 'Enter one of the backup codes you saved when setting up two-factor authentication.'
          : 'Enter the 6-digit code from your authenticator app to continue.'}
      </p>

      {displayError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400"
        >
          {isRateLimited ? 'Too many attempts. Please wait a moment and try again.' : displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {useBackupCode ? (
          <div className="space-y-2">
            <FormLabel htmlFor="backup-code" required>
              Backup code
            </FormLabel>
            <Input
              id="backup-code"
              type="text"
              value={code}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
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
              // REGEX-CONFIG-BOUNDARY: browser HTML validation attribute
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(filterDigits(e.target.value))}
              disabled={isLoading}
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              required
            />
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Verifying…' : 'Verify'}
        </Button>

        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
              setFormError(null);
            }}
            className="text-[var(--tenant-brand,#2563eb)] hover:underline"
          >
            {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code instead'}
          </button>

          <Link href="/login" className="hover:underline">
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
