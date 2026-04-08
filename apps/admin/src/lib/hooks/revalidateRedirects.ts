import type { RevealUIInstance } from '@revealui/core';
import { revalidateTag } from 'next/cache';

interface RevalidateContext {
  revealui?: RevealUIInstance;
  operation?: string;
}

// Generic hook that works with various CMS hook signatures
export function revalidateRedirects(args: {
  doc: unknown;
  req?: unknown;
  context?: RevalidateContext;
}): unknown {
  // Log if possible
  try {
    const ctx = args.context;
    ctx?.revealui?.logger?.info(
      `Revalidating redirects after ${ctx?.operation || 'change'} operation`,
    );
  } catch {
    // Ignore logging errors
  }

  revalidateTag('redirects', 'page');

  return args.doc;
}
