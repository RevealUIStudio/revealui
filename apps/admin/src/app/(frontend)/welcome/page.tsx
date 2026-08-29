'use client';

import { TIER_LABELS } from '@revealui/contracts/pricing';
import { Badge, Button } from '@revealui/presentation/client';
import { useEffect, useState } from 'react';
import { useLicense } from '@/lib/providers/LicenseProvider';
import { isLicenseTierId, welcomeExpiryCopy } from './welcome-expiry';

const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.revealui.com';
const STARTER_REPO_URL = 'https://github.com/RevealUIStudio/revealui';
const CLI_INSTALL_COMMAND = 'pnpm create revealui my-app';

/**
 * Post-purchase welcome page.
 *
 * Reachable at `/welcome` (with optional `?success=true` from Stripe checkout
 * return). Lands a paying customer on concrete first actions instead of
 * a billing dashboard. Without this, a Pro customer paying $49/mo would be
 * confronted with a CMS admin and no guidance.
 *
 * The success banner only renders when `?success=true` is in the URL —
 * direct visits (revisiting the page later) show the same CTAs
 * without the celebratory framing.
 *
 * When the paid-success state renders (`?success=true` and a paid tier),
 * the license key and first-agent CTAs lead, ahead of the CLI/source/guide
 * CTAs — a paying customer's next move is using what they paid for, not
 * reading docs. Non-paid variants keep the original order and simply gain
 * the agent CTA at the end.
 *
 * The `?denied=admin` banner renders when the proxy redirected an
 * authenticated non-admin here from an admin-only route. It explains why they
 * are not in the admin area instead of silently bouncing them to the login
 * form they just used (see apps/admin/src/proxy.ts).
 *
 * When GET /api/billing/subscription already has `expiresAt`, the hero shows
 * that date in plain language. The page never invents a trial end.
 */
export default function WelcomePage() {
  const { tier } = useLicense();
  const [isPostPurchase, setIsPostPurchase] = useState(false);
  const [deniedAdmin, setDeniedAdmin] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);
  const [expiryCopy, setExpiryCopy] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsPostPurchase(params.get('success') === 'true');
    setDeniedAdmin(params.get('denied') === 'admin');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/billing/subscription', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          tier?: unknown;
          status?: unknown;
          expiresAt?: unknown;
          perpetual?: unknown;
        };
        if (controller.signal.aborted) return;
        setExpiryCopy(
          welcomeExpiryCopy({
            tier: isLicenseTierId(data.tier) ? data.tier : tier,
            expiresAt: data.expiresAt,
            status: data.status,
            perpetual: data.perpetual,
          }),
        );
      } catch {
        // Network / abort — do not invent a date.
      }
    })();
    return () => controller.abort();
  }, [tier]);

  const tierLabel = TIER_LABELS[tier] ?? 'Free';
  const isPaidTier = tier !== 'free';
  const isPaidSuccess = isPostPurchase && isPaidTier;

  const handleCopyCli = async () => {
    try {
      await navigator.clipboard.writeText(CLI_INSTALL_COMMAND);
      setCliCopied(true);
      window.setTimeout(() => setCliCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. http://localhost without HTTPS).
      // Silently fail — the command is still visible for manual copy.
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
      {/* Access-denied notice: authenticated, but the admin area needs an admin role. */}
      {deniedAdmin && (
        <div
          role="status"
          className="mb-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
        >
          You are signed in, but the admin area requires an admin role. Here is your account home.
          If you need admin access, contact your workspace administrator.
        </div>
      )}

      {/* Hero */}
      <div className="text-center mb-12">
        {isPostPurchase && isPaidTier && (
          <div className="mb-6 flex justify-center">
            <Badge intent="success">
              <span role="img" aria-label="Checkmark">
                &#10003;
              </span>
              Your {tierLabel} subscription is active
            </Badge>
          </div>
        )}
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {isPostPurchase ? 'Welcome to RevealUI' : 'Get started with RevealUI'}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          {isPostPurchase
            ? 'Concrete first actions to put your subscription to work.'
            : 'New here? Start with one of these tracks.'}
        </p>
        {expiryCopy && (
          <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">{expiryCopy}</p>
        )}
      </div>

      {/* CTAs */}
      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
        {isPaidSuccess && (
          <>
            {/* CTA 1: License key */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="text-lg font-semibold">1</span>
              </div>
              <h2 className="text-lg font-semibold text-foreground">Your license key</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Find your license key and manage your subscription from account settings.
              </p>
              <a
                href="/account/license"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                View your license
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>

            {/* CTA 2: Run your first agent */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="text-lg font-semibold">2</span>
              </div>
              <h2 className="text-lg font-semibold text-foreground">First governed agent action</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Run an agent in your workspace. Every agent is a governed and audited user with a
                receipt you can check.
              </p>
              <a
                href="/agents"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                Open agents
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </>
        )}

        {/* CTA: Install the CLI */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-lg font-semibold">{isPaidSuccess ? 3 : 1}</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Install the CLI</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Scaffold a new RevealUI project locally. Fastest path to a running stack.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
            <code className="flex-1 truncate">{CLI_INSTALL_COMMAND}</code>
            <Button
              type="button"
              appearance="outline"
              variant="neutral"
              size="sm"
              onClick={() => void handleCopyCli()}
              className="h-auto px-2 py-1 text-xs"
              aria-label="Copy command to clipboard"
            >
              {cliCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* CTA: Clone the starter */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-lg font-semibold">{isPaidSuccess ? 4 : 2}</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Clone the source</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspect the full monorepo — apps, packages, contracts, schemas. Full source-code access
            is part of every paid tier.
          </p>
          <a
            href={STARTER_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Open on GitHub
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>

        {/* CTA: Read the first guide */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-lg font-semibold">{isPaidSuccess ? 5 : 3}</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Read the quick-start</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            5-minute walk-through: define a collection, get a REST API + admin UI + MCP tool
            automatically.
          </p>
          <a
            href={`${DOCS_URL}/quick-start`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Open the guide
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>

        {!isPaidSuccess && (
          /* CTA 4: Run your first agent (appended for non-paid variants) */
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="text-lg font-semibold">4</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Run your first agent</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Talk to an agent and watch it take a real action in your workspace.
            </p>
            <a
              href="/agents"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Open agents
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        )}
      </div>

      {/* Account-management footer */}
      <div className="mt-12 rounded-2xl border border-border bg-muted/40 p-6">
        <h2 className="text-sm font-semibold text-foreground">Manage your account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Update billing details, view invoices, or change your plan in account settings.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
          <a
            href="/account/billing"
            className="rounded-md bg-card px-3 py-1.5 text-foreground ring-1 ring-border transition-colors hover:bg-muted"
          >
            Billing portal
          </a>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-card px-3 py-1.5 text-foreground ring-1 ring-border transition-colors hover:bg-muted"
          >
            Full documentation
          </a>
        </div>
      </div>
    </div>
  );
}
