'use client';

import { TIER_LABELS } from '@revealui/contracts/pricing';
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
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <span role="img" aria-label="Checkmark">
              &#10003;
            </span>
            Your {tierLabel} subscription is active
          </div>
        )}
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
          {isPostPurchase ? 'Welcome to RevealUI' : 'Get started with RevealUI'}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          {isPostPurchase
            ? 'Three concrete first actions to put your subscription to work.'
            : 'New here? Start with one of these three tracks.'}
        </p>
      </div>

      {/* Three CTAs */}
      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
        {/* CTA 1: Install the CLI */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <span className="text-lg font-semibold">1</span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Install the CLI</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Scaffold a new RevealUI project locally. Fastest path to a running stack.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            <code className="flex-1 truncate">{CLI_INSTALL_COMMAND}</code>
            <button
              type="button"
              onClick={() => void handleCopyCli()}
              className="rounded bg-white px-2 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600 dark:hover:bg-zinc-600"
              aria-label="Copy command to clipboard"
            >
              {cliCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* CTA 2: Clone the starter */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
            <span className="text-lg font-semibold">2</span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Clone the source</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Inspect the full monorepo — apps, packages, contracts, schemas. Full source-code access
            is part of every paid tier.
          </p>
          <a
            href={STARTER_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Open on GitHub
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>

        {/* CTA 3: Read the first guide */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <span className="text-lg font-semibold">3</span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Read the quick-start
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            5-minute walk-through: define a collection, get a REST API + admin UI + MCP tool
            automatically.
          </p>
          <a
            href={`${DOCS_URL}/quick-start`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Open the guide
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>

      {/* Account-management footer */}
      <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Manage your account</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Update billing details, view invoices, or change your plan in account settings.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
          <a
            href="/account/billing"
            className="rounded-md bg-white px-3 py-1.5 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-700"
          >
            Billing portal
          </a>
          <a
            href="/admin"
            className="rounded-md bg-white px-3 py-1.5 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-700"
          >
            Admin dashboard
          </a>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-white px-3 py-1.5 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-700"
          >
            Full documentation
          </a>
        </div>
      </div>
    </div>
  );
}
