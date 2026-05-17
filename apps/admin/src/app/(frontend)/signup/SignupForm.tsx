'use client';

import { usePasskeyRegister, useSignUp } from '@revealui/auth/react';
import {
  ButtonCVA as Button,
  FormLabel,
  Heading,
  InputCVA as Input,
  PasskeyIcon,
} from '@revealui/presentation/server';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ChangeEvent, type FormEvent, Suspense, useState } from 'react';
import { PasswordInput } from '@/lib/components/PasswordInput';

interface SignupFormProps {
  /** API base URL resolved server-side to avoid build-time env inlining. */
  apiUrl: string;
}

function SignupSkeleton() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="h-7 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-11 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

export function SignupForm({ apiUrl }: SignupFormProps) {
  return (
    <Suspense fallback={<SignupSkeleton />}>
      <SignupContent apiUrl={apiUrl} />
    </Suspense>
  );
}

function SignupContent({ apiUrl }: SignupFormProps) {
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
      for (const type of ['necessary', 'functional'] as const) {
        fetch(`${apiUrl}/api/gdpr/consent/grant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type }),
        }).catch(() => {
          // Best-effort — consent tracking should not block signup
        });
      }

      if (plan === 'pro') {
        router.push('/account/billing?upgrade=pro');
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

  if (backupCodes) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <Heading as="h2" size="lg" className="tracking-tight">
          Save your backup codes
        </Heading>
        <p className="text-sm text-muted-foreground">
          Store these codes in a safe place. You can use them to sign in if you lose access to your
          passkey.
        </p>
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
        <Button onClick={() => router.push('/')} className="w-full">
          I&apos;ve saved my codes
        </Button>
      </div>
    );
  }

  const displayError = error ?? passkeyError;

  return (
    <div className="w-full max-w-sm space-y-6">
      <Heading as="h2" size="lg" className="tracking-tight">
        Create your account
      </Heading>

      {plan === 'pro' ? (
        <p className="text-sm text-muted-foreground">Sign up to start your free 7-day Pro trial.</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-[var(--tenant-brand,#2563eb)] underline hover:opacity-80"
          >
            Sign in
          </Link>
        </p>
      )}

      {displayError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400"
        >
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <FormLabel htmlFor="name" required>
            Name
          </FormLabel>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
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
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
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
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
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
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTosAccepted(e.target.checked)}
            disabled={anyLoading}
            required
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[var(--tenant-brand,#2563eb)] accent-[var(--tenant-brand,#2563eb)]"
          />
          <label htmlFor="tos" className="text-sm text-zinc-600 dark:text-zinc-400">
            I agree to the{' '}
            <Link
              href="/legal/terms"
              className="text-[var(--tenant-brand,#2563eb)] hover:underline"
              target="_blank"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href="/legal/privacy"
              className="text-[var(--tenant-brand,#2563eb)] hover:underline"
              target="_blank"
            >
              Privacy Policy
            </Link>
          </label>
        </div>

        <Button type="submit" disabled={anyLoading || !tosAccepted} className="w-full">
          {isLoading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      {passkeySupported ? (
        <>
          <p className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
            or
          </p>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handlePasskeySignUp}
            disabled={anyLoading}
          >
            <PasskeyIcon className="size-4 shrink-0" />
            <span>{isPasskeyLoading ? 'Registering…' : 'Sign up with passkey'}</span>
          </Button>
        </>
      ) : null}
    </div>
  );
}
