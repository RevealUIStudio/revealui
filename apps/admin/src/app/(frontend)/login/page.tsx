'use client';

import { usePasskeySignIn, useSignIn } from '@revealui/auth/react';
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
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';
import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';
import { PasswordInput } from '@/lib/components/PasswordInput';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You cancelled the sign-in. Please try again.',
  oauth_error: 'The sign-in provider returned an error. Please try again.',
  provider_error: 'The sign-in provider returned an error. Please try again.',
  invalid_state: 'The sign-in request expired. Please try again.',
  account_exists:
    'An account with this email already exists. Sign in with your password, or link this provider from your account settings.',
  not_allowed: 'Your account is not authorized. Contact the administrator for access.',
  unknown_provider: 'Unknown sign-in provider. Please try again.',
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <BrandedAuthLayout>
          <Card className="w-full max-w-sm">
            <CardHeader>
              <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </CardContent>
          </Card>
        </BrandedAuthLayout>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isLoading } = useSignIn();
  const {
    signIn: passkeySignIn,
    isLoading: isPasskeyLoading,
    error: passkeyError,
    supported: passkeySupported,
  } = usePasskeySignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const oauthError = searchParams.get('error');
  const [error, setError] = useState<string | null>(
    oauthError ? (OAUTH_ERROR_MESSAGES[oauthError] ?? 'Sign-in failed. Please try again.') : null,
  );

  const anyLoading = isLoading || isPasskeyLoading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = await signIn({ email, password });
    if (result.success) {
      router.push('/admin');
    } else if ('requiresMfa' in result && result.requiresMfa) {
      router.push('/mfa');
    } else {
      const errorMessage = 'error' in result ? result.error : 'Failed to sign in';
      setError(errorMessage || 'Failed to sign in');
    }
  };

  const handlePasskeySignIn = async () => {
    setError(null);
    const success = await passkeySignIn();
    if (success) {
      router.push('/admin');
    }
  };

  return (
    <BrandedAuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to your account</CardTitle>
          <CardDescription>
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Sign up
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(error ?? passkeyError) && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error ?? passkeyError}
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
                onChange={(e) => setEmail(e.target.value)}
                disabled={anyLoading}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <FormLabel htmlFor="password" required>
                Password
              </FormLabel>
              <PasswordInput visible={showPassword} onToggle={() => setShowPassword((v) => !v)}>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={anyLoading}
                  autoComplete="current-password"
                  className="pr-10"
                  aria-label="Password"
                  required
                />
              </PasswordInput>
            </div>

            <Button type="submit" disabled={anyLoading} className="w-full">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>

            <p className="text-center text-sm text-zinc-500">
              <Link
                href="/reset-password"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Forgot password?
              </Link>
            </p>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {passkeySupported && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handlePasskeySignIn}
                disabled={anyLoading}
              >
                {isPasskeyLoading ? 'Authenticating...' : 'Sign in with passkey'}
              </Button>
            )}
            <Button variant="outline" className="w-full" asChild>
              <a href="/api/auth/github">Sign in with GitHub</a>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <a href="/api/auth/google">Sign in with Google</a>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <a href="/api/auth/vercel">Sign in with Vercel</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </BrandedAuthLayout>
  );
}
