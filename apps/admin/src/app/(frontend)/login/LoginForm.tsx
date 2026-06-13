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
  const messageKey = searchParams.get('message');
  const successMessage = messageKey ? SUCCESS_MESSAGES[messageKey] : undefined;
  const rawUpgrade = searchParams.get('upgrade');
  const upgrade: 'pro' | 'max' | null =
    rawUpgrade === 'pro' || rawUpgrade === 'max' ? rawUpgrade : null;

  const anyLoading = isLoading || isPasskeyLoading;
  const hasAlternates = oauthProviders.length > 0 || passkeySupported;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = await signIn({ email, password });
    if (result.success && 'requiresPasswordRotation' in result && result.requiresPasswordRotation) {
      navigateAfterAuthChange('/rotate-password');
    } else if (result.success) {
      const dest = isAdminRole(result.user.role)
        ? upgrade
          ? `/account/billing?upgrade=${upgrade}`
          : '/'
        : '/welcome';
      navigateAfterAuthChange(dest);
    } else if ('requiresMfa' in result && result.requiresMfa) {
      navigateAfterAuthChange('/mfa');
    } else {
      const errorMessage = 'error' in result ? result.error : 'Failed to sign in';
      setError(errorMessage || 'Failed to sign in');
    }
  };

  const handlePasskeySignIn = async () => {
    setError(null);
    const success = await passkeySignIn();
    if (success) {
      navigateAfterAuthChange('/');
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
