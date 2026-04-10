'use client';

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
import { useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';
import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';
import { PasswordInput } from '@/lib/components/PasswordInput';

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
      <BrandedAuthLayout>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              If an account exists for {email}, we sent a password reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Back to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </BrandedAuthLayout>
    );
  }

  return (
    <BrandedAuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>Enter your email and we&apos;ll send you a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <FormLabel htmlFor="email" required>
                Email
              </FormLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                required
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>

            <p className="text-center text-sm text-zinc-600">
              <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
                Back to Sign In
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </BrandedAuthLayout>
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
      <BrandedAuthLayout>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Password Reset</CardTitle>
            <CardDescription>Your password has been updated. You can now sign in.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </BrandedAuthLayout>
    );
  }

  return (
    <BrandedAuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set New Password</CardTitle>
          <CardDescription>Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <FormLabel htmlFor="password" required>
                New Password
              </FormLabel>
              <PasswordInput visible={showPassword} onToggle={() => setShowPassword((v) => !v)}>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </BrandedAuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <BrandedAuthLayout>
          <Card className="w-full max-w-sm">
            <CardHeader>
              <div className="h-6 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </CardContent>
          </Card>
        </BrandedAuthLayout>
      }
    >
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
