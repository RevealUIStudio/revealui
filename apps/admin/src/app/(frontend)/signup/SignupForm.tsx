'use client';

import { usePasskeyRegister } from '@revealui/auth/react';
import {
  Button,
  FormLabel,
  Heading,
  InputCVA as Input,
  PasskeyIcon,
} from '@revealui/presentation/server';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ChangeEvent, type FormEvent, Suspense, useState } from 'react';
import { PasswordInput } from '@/lib/components/PasswordInput';
import { navigateAfterAuthChange } from '@/lib/utils/auth-navigation';
import { apiFetch } from '@/lib/utils/csrf';

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
  // Paid-tier deep link from the marketing pricing cards (?plan=pro|max).
  // Unknown values are ignored rather than forwarded to the billing page.
  const planParam = searchParams.get('plan');
  const plan: 'pro' | 'max' | null = planParam === 'pro' || planParam === 'max' ? planParam : null;
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
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const anyLoading = isLoading || isPasskeyLoading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tosAccepted) {
      setError('You must accept the Terms of Service to create an account.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/auth/sign-up${plan ? `?plan=${plan}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, tosAccepted: true }),
      });
      const data = (await res.json()) as { user?: { emailVerified?: boolean }; error?: string };
      if (res.ok) {
        for (const type of ['necessary', 'functional'] as const) {
          apiFetch(`${apiUrl}/api/gdpr/consent/grant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type }),
          }).catch(() => {
            // Best-effort — consent tracking should not block signup
          });
        }
        // The first user is auto-verified and gets a session immediately, so send
        // them straight in. Everyone else must verify their email before they can
        // sign in — show a confirmation screen instead of pushing them to a
        // protected route that would only bounce back to /login.
        if (data.user?.emailVerified) {
          if (plan) {
            navigateAfterAuthChange(`/account/billing?upgrade=${plan}`);
          } else {
            navigateAfterAuthChange('/welcome');
          }
        } else {
          setAwaitingVerification(true);
        }
      } else {
        setError(data.error || 'Failed to create account');
      }
    } catch {
      setError('Failed to create account');
    } finally {
      setIsLoading(false);
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
        navigateAfterAuthChange(plan ? `/account/billing?upgrade=${plan}` : '/welcome');
      }
    }
  };

  const handleResendVerification = async () => {
    setResendState('sending');
    try {
      // Session-less resend: the route accepts { email } without a session and
      // always answers with the same generic 200, so this needs no auth state.
      // apiFetch still matters here: a lingering session cookie (stale or
      // live) makes the admin proxy demand a CSRF token on this POST.
      await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // The endpoint answers identically either way; a network blip reads the same.
    }
    setResendState('sent');
  };

  if (awaitingVerification) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <Heading as="h2" size="lg" className="tracking-tight">
          Check your inbox
        </Heading>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to{' '}
          <span className="font-medium text-foreground">{email}</span>. Click it to activate your
          account, then sign in.
        </p>
        <p className="text-xs text-zinc-600">
          Didn&apos;t get it? Check your spam folder — the link can take a minute to arrive.
        </p>
        <Button
          appearance="outline"
          variant="neutral"
          onClick={handleResendVerification}
          disabled={resendState === 'sending'}
          className="w-full"
        >
          {resendState === 'sent'
            ? 'Sent. Check your inbox again.'
            : resendState === 'sending'
              ? 'Sending…'
              : 'Resend verification email'}
        </Button>
        <Button onClick={() => router.push('/login')} className="w-full">
          Go to sign in
        </Button>
      </div>
    );
  }

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
        <Button
          onClick={() =>
            navigateAfterAuthChange(plan ? `/account/billing?upgrade=${plan}` : '/welcome')
          }
          className="w-full"
        >
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

      {plan ? (
        <p className="text-sm text-muted-foreground">
          Sign up to start your free 7-day {plan === 'pro' ? 'Pro' : 'Max'} trial.
        </p>
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
          {/* The checkbox's accessible name comes from this sr-only label rather than
           * wrapping the visible text in a <label>, because the visible text contains
           * <Link> anchors: a <label> nesting interactive links is an a11y anti-pattern
           * (ambiguous click target between the label's implicit toggle and the link's
           * own navigation, and inconsistent accessible-name computation). */}
          <label htmlFor="tos" className="sr-only">
            Accept the Terms of Service and Privacy Policy
          </label>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
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
          </span>
        </div>

        <Button type="submit" disabled={anyLoading || !tosAccepted} className="w-full">
          {isLoading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      {passkeySupported ? (
        <>
          <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">
            or
          </p>
          <Button
            appearance="outline"
            variant="neutral"
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
