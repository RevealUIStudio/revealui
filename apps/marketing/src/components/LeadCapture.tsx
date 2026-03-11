'use client';

import { logger } from '@revealui/core/observability/logger';
import { useState } from 'react';

export function LeadCapture() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const extractErrorMessage = (payload: unknown): string | null => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    const { error } = payload as { error?: unknown };
    return typeof error === 'string' ? error : null;
  };

  const submitWaitlist = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as unknown;
      const errorMessage = extractErrorMessage(payload);

      if (!response.ok) {
        throw new Error(errorMessage ?? 'Failed to join waitlist');
      }

      setIsSubmitted(true);
      setEmail('');
    } catch (error) {
      logger.error(
        'Waitlist signup error',
        error instanceof Error ? error : new Error(String(error)),
      );
      setErrorMessage('Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void submitWaitlist();
  };

  if (isSubmitted) {
    return (
      <section className="py-24 bg-gray-950 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <svg
                className="h-8 w-8 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <title>Success</title>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              You&apos;re on the list
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-400">
              We&apos;ll send you early access details and updates on our launch. Stay tuned.
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              type="button"
              className="mt-8 rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-gray-950 shadow-sm hover:bg-gray-100 transition-colors"
            >
              Add Another Email
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="waitlist" className="py-24 bg-gray-950 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Get early access to Pro
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-400">
            The MIT core is live on npm today. Join the list for Pro launch pricing, new feature
            announcements, and first access to AI agents, MCP servers, and billing automation.
          </p>
          <form onSubmit={handleSubmit} className="mt-10">
            <div className="flex max-w-md mx-auto gap-x-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="min-w-0 flex-auto rounded-lg border-0 bg-gray-900 px-4 py-3.5 text-sm text-white shadow-sm ring-1 ring-inset ring-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-colors"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-none rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-gray-950 shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Joining...' : 'Join Waitlist'}
              </button>
            </div>
          </form>
          {errorMessage && (
            <p className="mt-4 text-sm text-red-400" role="alert">
              {errorMessage}
            </p>
          )}
          <p className="mt-6 text-sm leading-6 text-gray-500">
            No spam, ever. Unsubscribe at any time.
          </p>
        </div>
      </div>
    </section>
  );
}
