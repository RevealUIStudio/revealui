'use client';

import { usePasskeySignIn, useSignIn } from '@revealui/auth/react';
import {
  ButtonCVA as Button,
  FormLabel,
  GitHubIcon,
  GoogleIcon,
  Heading,
  InputCVA as Input,
  LinkedInIcon,
  PasskeyIcon,
  VercelIcon,
} from '@revealui/presentation/server';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ChangeEvent, type FormEvent, Suspense, useState } from 'react';
import { isAdminRole } from '@/lib/access/roles/isAdminRole';
import { PasswordInput } from '@/lib/components/PasswordInput';
import { navigateAfterAuthChange } from '@/lib/utils/auth-navigation';
import { buildAuthIntentQuery, readAuthIntent, resolveAuthDest } from '@/lib/utils/auth-redirect';

export type OAuthProvider = 'github' | 'google' | 'vercel' | 'linkedin';

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

// Success notices surfaced from query params. The email-verification link
// (GET /api/auth/verify-email) redirects here with ?message=email_verified.
const SUCCESS_MESSAGES: Record<string, string> = {
  email_verified: 'Your email is verified — sign in to continue.',
  already_verified: 'Your email is already verified — sign in to continue.',
};

// Sign-in error code (from the API `code` field) that the login form can
// recover from in-place by offering to resend the verification email.
const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED';

const OAUTH_META: Record<OAuthProvider, { label: string; href: string; Icon: typeof GitHubIcon }> =
  {
    github: { label: 'GitHub', href: '/api/auth/github', Icon: GitHubIcon },
    google: { label: 'Google', href: '/api/auth/google', Icon: GoogleIcon },
    vercel: { label: 'Vercel', href: '/api/auth/vercel', Icon: VercelIcon },
    linkedin: { label: 'LinkedIn', href: '/api/auth/linkedin', Icon: LinkedInIcon },
  };

interface LoginFormProps {
  /** OAuth providers to render; empty array suppresses the OAuth row entirely. */
  oauthProviders: OAuthProvider[];
}

function LoginSkeleton() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="h-7 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-11 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

export function LoginForm({ oauthProviders }: LoginFormProps) {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent oauthProviders={oauthProviders} />
    </Suspense>
  );
}

function LoginContent({ oauthProviders }: LoginFormProps) {
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
  // When sign-in fails with EMAIL_NOT_VERIFIED, hold the address so the user can
  // resend their verification link in-place instead of hitting a dead end.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const messageKey = searchParams.get('message');
  const successMessage = messageKey ? SUCCESS_MESSAGES[messageKey] : undefined;
  const { upgrade, redirect } = readAuthIntent(searchParams);

  const anyLoading = isLoading || isPasskeyLoading;
  const hasAlternates = oauthProviders.length > 0 || passkeySupported;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    setResendState('idle');

    const result = await signIn({ email, password });
    if (result.success && 'requiresPasswordRotation' in result && result.requiresPasswordRotation) {
      // Carry the intent through the rotation step so the destination survives it.
      navigateAfterAuthChange(`/rotate-password${buildAuthIntentQuery({ upgrade, redirect })}`);
    } else if (result.success) {
      const dest = resolveAuthDest({
        upgrade,
        redirect,
        fallback: isAdminRole(result.user.role) ? '/' : '/welcome',
      });
      navigateAfterAuthChange(dest);
    } else if ('requiresMfa' in result && result.requiresMfa) {
      // Carry the intent through the MFA step so the destination survives it.
      navigateAfterAuthChange(`/mfa${buildAuthIntentQuery({ upgrade, redirect })}`);
    } else {
      const errorMessage = 'error' in result ? result.error : 'Failed to sign in';
      setError(errorMessage || 'Failed to sign in');
      // Offer a self-service resend when the wall is an unverified email, so a
      // never-delivered verification link is recoverable from the login screen.
      const code = 'code' in result ? result.code : undefined;
      setUnverifiedEmail(code === EMAIL_NOT_VERIFIED_CODE ? email : null);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setResendState('sending');
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
    } catch {
      // The endpoint returns a constant accepted response by design (anti-
      // enumeration), so even a transient failure shows the same confirmation.
    }
    setResendState('sent');
  };

  const handlePasskeySignIn = async () => {
    setError(null);
    setUnverifiedEmail(null);
    setResendState('idle');
    const success = await passkeySignIn();
    if (success) {
      // Passkey sign-in returns no user object, so role-default falls back to '/'.
      navigateAfterAuthChange(resolveAuthDest({ upgrade, redirect, fallback: '/' }));
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <Heading as="h2" size="lg" className="tracking-tight">
        Sign in
      </Heading>

      {successMessage && !(error ?? passkeyError) && (
        <div
          role="status"
          className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
        >
          {successMessage}
        </div>
      )}

      {(error ?? passkeyError) && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400"
        >
          {error ?? passkeyError}
        </div>
      )}

      {unverifiedEmail && (
        <div
          role="status"
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
        >
          {resendState === 'sent' ? (
            <p>
              If that account exists and is unverified, a new verification link is on its way. Check
              your inbox.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p>Your email address is not verified yet.</p>
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={resendState === 'sending'}
                className="self-start rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-amber-300 transition-colors hover:bg-amber-200 disabled:opacity-60 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800"
              >
                {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
              </button>
            </div>
          )}
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
              autoComplete="current-password"
              className="pr-10"
              aria-label="Password"
              required
            />
          </PasswordInput>
        </div>

        <Button type="submit" disabled={anyLoading} className="w-full">
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          <Link
            href="/reset-password"
            className="text-[var(--tenant-brand,#2563eb)] hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </form>

      {hasAlternates ? (
        <>
          <p className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
            or continue with
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {passkeySupported ? (
              <Button
                variant="outline"
                onClick={handlePasskeySignIn}
                disabled={anyLoading}
                className="justify-start gap-2"
              >
                <PasskeyIcon className="size-4 shrink-0" />
                <span>{isPasskeyLoading ? 'Authenticating…' : 'Passkey'}</span>
              </Button>
            ) : null}

            {oauthProviders.map((provider) => {
              const { label, href, Icon } = OAUTH_META[provider];
              return (
                <Button key={provider} variant="outline" className="justify-start gap-2" asChild>
                  <a href={href}>
                    <Icon className="size-4 shrink-0" />
                    <span>{label}</span>
                  </a>
                </Button>
              );
            })}
          </div>
        </>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="text-[var(--tenant-brand,#2563eb)] underline hover:opacity-80"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
