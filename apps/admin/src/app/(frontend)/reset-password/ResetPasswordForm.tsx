'use client';

import {
  ButtonCVA as Button,
  FormLabel,
  Heading,
  InputCVA as Input,
} from '@revealui/presentation/server';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ChangeEvent, type FormEvent, Suspense, useState } from 'react';
import { PasswordInput } from '@/lib/components/PasswordInput';

function ResetPasswordSkeleton() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="h-7 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-11 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<ResetPasswordSkeleton />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const tokenId = searchParams.get('id');
  const token = searchParams.get('token');

  if (tokenId && token) {
    return <ResetWithTokenForm tokenId={tokenId} token={token} />;
  }

  return <RequestResetForm />;
}

function RequestResetForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || 'Failed to send reset email');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <Heading as="h2" size="lg" className="tracking-tight">
          Check your email
        </Heading>
        <p className="text-sm text-muted-foreground">
          If an account exists for {email}, we sent a password reset link.
        </p>
        <Button appearance="outline" variant="neutral" className="w-full" asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <Heading as="h2" size="lg" className="tracking-tight">
        Reset password
      </Heading>
      <p className="text-sm text-muted-foreground">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <FormLabel htmlFor="email" required>
            Email
          </FormLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            disabled={isLoading}
            autoComplete="email"
            required
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Sending…' : 'Send reset link'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-[var(--tenant-brand,#2563eb)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

function ResetWithTokenForm({ tokenId, token }: { tokenId: string; token: string }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, token, password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || 'Failed to reset password');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <Heading as="h2" size="lg" className="tracking-tight">
          Password reset
        </Heading>
        <p className="text-sm text-muted-foreground">
          Your password has been updated. You can now sign in.
        </p>
        <Button className="w-full" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <Heading as="h2" size="lg" className="tracking-tight">
        Set new password
      </Heading>

      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <FormLabel htmlFor="password" required>
            New password
          </FormLabel>
          <PasswordInput visible={showPassword} onToggle={() => setShowPassword((v) => !v)}>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
              className="pr-10"
              aria-label="Password"
              minLength={8}
              required
            />
          </PasswordInput>
          <p className="text-xs text-zinc-600">Minimum 8 characters</p>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </div>
  );
}
