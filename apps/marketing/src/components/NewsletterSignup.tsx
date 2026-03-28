'use client';

import { useState } from 'react';

export function NewsletterSignup({ variant = 'inline' }: { variant?: 'inline' | 'stacked' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string };
      if (res.ok) {
        setStatus('success');
        setMessage(data.message ?? 'You are on the list.');
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className={variant === 'stacked' ? 'text-center' : ''}>
        <p className="text-sm font-medium text-emerald-400">{message}</p>
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm mx-auto">
        <label htmlFor="newsletter-email-stacked" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email-stacked"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          className="w-full rounded-lg bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
        </button>
        {status === 'error' && <p className="text-xs text-red-400">{message}</p>}
        <p className="text-xs text-gray-500">Product updates and engineering insights. No spam.</p>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        required
        className="flex-1 min-w-0 rounded-lg bg-white/5 px-4 py-2 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? '...' : 'Subscribe'}
      </button>
      {status === 'error' && <p className="text-xs text-red-400 mt-1">{message}</p>}
    </form>
  );
}
