import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';
import { LoginForm, type OAuthProvider } from './LoginForm';

/**
 * Server Component shell — critical that this is NOT 'use client'.
 *
 * Reads `REVEALUI_OAUTH_PROVIDERS` (comma-separated list, e.g. "github,google,vercel,linkedin")
 * at request time and passes the parsed allowlist down to the Client form.
 * Reading env in a Client Component would inline values at build time (when
 * tenant/admin env isn't set), so this gate must live on the server.
 *
 * For Fleet kits that don't configure OAuth, leave `REVEALUI_OAUTH_PROVIDERS`
 * unset — the form will render email/password + passkey only and skip the
 * OAuth row entirely.
 */

const SUPPORTED_PROVIDERS = ['github', 'google', 'vercel', 'linkedin'] as const satisfies readonly OAuthProvider[];

function parseProviders(raw: string | undefined): OAuthProvider[] {
  if (!raw) return [];
  const tokens = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return SUPPORTED_PROVIDERS.filter((p) => tokens.has(p));
}

export default function LoginPage() {
  const oauthProviders = parseProviders(process.env.REVEALUI_OAUTH_PROVIDERS);

  return (
    <BrandedAuthLayout>
      <LoginForm oauthProviders={oauthProviders} />
    </BrandedAuthLayout>
  );
}
