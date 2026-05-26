import { ButtonCVA as Button, Input } from '@revealui/presentation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { submitNewsletter } from '../lib/api';

export function NewsletterSignup({ variant = 'inline' }: { variant?: 'inline' | 'stacked' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');
    const error = await submitNewsletter({ email });
    if (error === null) {
      setStatus('success');
      setMessage('You are on the list.');
      setEmail('');
    } else {
      setStatus('error');
      setMessage(error);
    }
  }

  if (status === 'success') {
    return (
      <p
        className={`animate-[fade-in_300ms_ease-out] text-sm font-medium text-primary ${
          variant === 'stacked' ? 'text-center' : ''
        }`}
      >
        {message}
      </p>
    );
  }

  if (variant === 'stacked') {
    return (
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-sm flex-col gap-3">
        <label htmlFor="newsletter-email-stacked" className="sr-only">
          Email address
        </label>
        <Input
          id="newsletter-email-stacked"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
        />
        <Button
          type="submit"
          variant="primary"
          isLoading={status === 'loading'}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
        </Button>
        {status === 'error' && <p className="text-xs text-destructive">{message}</p>}
        <p className="text-xs text-muted-foreground">
          Product updates and engineering insights. No spam.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <Input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          variant="primary"
          isLoading={status === 'loading'}
          disabled={status === 'loading'}
          className="shrink-0"
        >
          Subscribe
        </Button>
      </div>
      {status === 'error' && <p className="text-xs text-destructive">{message}</p>}
    </form>
  );
}
