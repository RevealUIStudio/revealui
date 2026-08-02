import { getCacheLogger, revalidateTag } from '@revealui/cache';
import type { RevealUIInstance } from '@revealui/core';

interface RevalidateContext {
  revealui?: RevealUIInstance;
  operation?: string;
}

// Generic hook that works with various admin hook signatures
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

  // Store APIs are async; afterChange hooks are sync — fire and log failures.
  void revalidateTag('redirects').catch((error: unknown) => {
    getCacheLogger().error('revalidateRedirects: revalidateTag failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return args.doc;
}
