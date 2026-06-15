'use client';

import { TIER_LABELS } from '@revealui/contracts/pricing';
import { Badge } from '@revealui/presentation/client';
import { useEffect, useState } from 'react';
import { useLicense } from '@/lib/providers/LicenseProvider';

const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.revealui.com';
const STARTER_REPO_URL = 'https://github.com/RevealUIStudio/revealui';
const CLI_INSTALL_COMMAND = 'pnpm create revealui my-app';

/**
 * Post-purchase welcome page.
 *
 * Reachable at `/welcome` (with optional `?success=true` from Stripe checkout
 * return). Lands a paying customer on three concrete first actions instead of
 * a billing dashboard. Without this, a Pro customer paying $49/mo would be
 * confronted with a CMS admin and no guidance.
 *
 * The success banner only renders when `?success=true` is in the URL —
 * direct visits (revisiting the page later) show the same three CTAs
 * without the celebratory framing.
 */
export default function WelcomePage() {
  const { tier } = useLicense();
  const [isPostPurchase, setIsPostPurchase] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsPostPurchase(params.get('success') === 'true');
  }, []);

  const tierLabel = TIER_LABELS[tier] ?? 'Free';
  const isPaidTier = tier !== 'free';

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
      {/* Hero */}
      <div className="text-center mb-12">
        {isPostPurchase && isPaidTier && (
          <div className="mb-6 flex justify-center">
            <Badge color="success">
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
            ? 'Three concrete first actions to put your subscription to work.'
            : 'New here? Start with one of these three tracks.'}
        </p>
      </div>

      {/* Three CTAs */}
      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
        {/* CTA 1: Install the CLI */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-lg font-semibold">1</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Install the CLI</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Scaffold a new RevealUI project locally. Fastest path to a running stack.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
            <code className="flex-1 truncate">{CLI_INSTALL_COMMAND}</code>
            <button
              type="button"
              onClick={() => void handleCopyCli()}
              className="rounded bg-card px-2 py-1 text-xs font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted"
              aria-label="Copy command to clipboard"
            >
              {cliCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* CTA 2: Clone the starter */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-lg font-semibold">2</span>
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

        {/* CTA 3: Read the first guide */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-lg font-semibold">3</span>
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
            href="/admin"
            className="rounded-md bg-card px-3 py-1.5 text-foreground ring-1 ring-border transition-colors hover:bg-muted"
          >
            Admin dashboard
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
