'use client';

import { usePasskeyRegister, useSignUp } from '@revealui/auth/react';
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

export default function SignupPage() {
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
                <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </CardContent>
          </Card>
        </BrandedAuthLayout>
      }
    >
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const { signUp, isLoading } = useSignUp();
  const {
    register: registerPasskey,
    isLoading: isPasskeyLoading,
    error: passkeyError,
    supported: passkeySupported,
  } = usePasskeyRegister();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const anyLoading = isLoading || isPasskeyLoading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tosAccepted) {
      setError('You must accept the Terms of Service to create an account.');
      return;
    }

    const result = await signUp({ email, password, name, tosAccepted: true });
    if (result.success) {
      // Record GDPR consent for necessary + functional (fire-and-forget)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';
      for (const type of ['necessary', 'functional'] as const) {
        fetch(`${apiUrl}/api/gdpr/consent/grant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type }),
        }).catch(() => {
          // Best-effort  -  consent tracking should not block signup
        });
      }

      if (plan === 'pro') {
        router.push('/account/billing?upgrade=pro');
      } else if (result.user?.role === 'admin') {
        router.push('/');
      } else {
        router.push('/');
      }
    } else {
      setError(result.error || 'Failed to create account');
    }
  };

  const handlePasskeySignUp = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address before signing up with a passkey.');
      return;
    }

    if (!name.trim()) {
      setError('Please enter your name before signing up with a passkey.');
      return;
    }

    if (!tosAccepted) {
      setError('You must accept the Terms of Service to create an account.');
      return;
    }

    const result = await registerPasskey({ email: email.trim(), name: name.trim() });
    if (result) {
      if (result.backupCodes?.length) {
        setBackupCodes(result.backupCodes);
      } else {
        router.push('/');
      }
    }
  };

  const handleAcknowledgeCodes = () => {
    router.push('/');
  };

  if (backupCodes) {
    return (
      <BrandedAuthLayout>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Save your backup codes</CardTitle>
            <CardDescription>
              Store these codes in a safe place. You can use them to sign in if you lose access to
              your passkey.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-md bg-zinc-50 p-4 font-mono text-sm dark:bg-zinc-800/50">
                {backupCodes.map((code) => (
                  <div key={code} className="py-0.5">
                    {code}
                  </div>
                ))}
              </div>

              <p className="text-xs text-zinc-600">
                Each code can only be used once. Keep them somewhere safe.
              </p>

              <Button onClick={handleAcknowledgeCodes} className="w-full">
                I&apos;ve saved my codes
              </Button>
            </div>
          </CardContent>
        </Card>
      </BrandedAuthLayout>
    );
  }

  const displayError = error ?? passkeyError;

  return (
    <BrandedAuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            {plan === 'pro' ? (
              'Sign up to start your free 7-day Pro trial.'
            ) : (
              <>
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Sign in
                </Link>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {displayError}
              </div>
            )}

            <div className="space-y-2">
              <FormLabel htmlFor="name" required>
                Name
              </FormLabel>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={anyLoading}
                autoComplete="name"
                required
              />
            </div>

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
                  autoComplete="new-password"
                  className="pr-10"
                  aria-label="Password"
                  minLength={8}
                  required
                />
              </PasswordInput>
              <p className="text-xs text-zinc-600">
                Min 8 characters, uppercase, lowercase, and a number
              </p>
            </div>

            <div className="flex items-start gap-2">
              <input
                id="tos"
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                disabled={anyLoading}
                required
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600"
              />
              <label htmlFor="tos" className="text-sm text-zinc-600 dark:text-zinc-400">
                I agree to the{' '}
                <Link
                  href="/legal/terms"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  target="_blank"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/legal/privacy"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  target="_blank"
                >
                  Privacy Policy
                </Link>
              </label>
            </div>

            <Button type="submit" disabled={anyLoading || !tosAccepted} className="w-full">
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          {passkeySupported && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handlePasskeySignUp}
                disabled={anyLoading}
              >
                {isPasskeyLoading ? 'Registering passkey...' : 'Sign up with passkey'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </BrandedAuthLayout>
  );
}
