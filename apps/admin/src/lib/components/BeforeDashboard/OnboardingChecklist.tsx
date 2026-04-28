'use client';

import Link from 'next/link';
import { useState } from 'react';

const DISMISSED_KEY = 'revealui-onboarding-dismissed';

interface ChecklistItem {
  label: string;
  description: string;
  href: string;
  external?: boolean;
}

const items: ChecklistItem[] = [
  {
    label: 'Create your first page',
    description: 'Add a homepage, about page, or blog post to get started.',
    href: '/pages',
  },
  {
    label: 'Add a product',
    description: 'Set up your first product with pricing and details.',
    href: '/products',
  },
  {
    label: 'Configure settings',
    description: 'Set your site name, branding, and preferences.',
    href: '/settings',
  },
  {
    label: 'Explore the docs',
    description: 'Guides for content, payments, AI, and deployment.',
    href: 'https://docs.revealui.com',
    external: true,
  },
];

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export default function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // localStorage unavailable  -  dismiss in-memory only
    }
    setDismissed(true);
  };

  return (
    <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Getting Started</h2>
          <p className="mt-0.5 text-sm text-zinc-400">
            Welcome to RevealUI. Here are a few things to get you going.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          Dismiss
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const props = item.external
            ? { target: '_blank' as const, rel: 'noopener noreferrer' }
            : {};

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800 p-3 transition-colors hover:border-zinc-500 hover:bg-zinc-750"
              {...props}
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-xs text-zinc-500">
                {items.indexOf(item) + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
