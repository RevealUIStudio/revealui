import { ButtonCVA as Button, Input } from '@revealui/presentation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { FO_MANAGED_WAITLIST } from '../../content/for-operators-managed';
import { submitWaitlist } from '../../lib/api';

export function Waitlist() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');
    // Source-tagged so RevealUI Cloud interest is queryable separately from
    // newsletter signups (apps/server POST /api/waitlist → waitlist table).
    const error = await submitWaitlist({ email, source: FO_MANAGED_WAITLIST.product });
    if (error === null) {
      setStatus('success');
      setMessage(FO_MANAGED_WAITLIST.successMessage);
      setEmail('');
    } else {
      setStatus('error');
      setMessage(error);
    }
  }

  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {FO_MANAGED_WAITLIST.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FO_MANAGED_WAITLIST.heading}
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground">
          {FO_MANAGED_WAITLIST.body}
        </p>

        {status === 'success' ? (
          <p className="mt-10 animate-[fade-in_300ms_ease-out] text-base font-medium text-primary">
            {message}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mx-auto mt-10 flex max-w-sm flex-col gap-3">
            <label htmlFor="waitlist-email" className="sr-only">
              Email address
            </label>
            <Input
              id="waitlist-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={FO_MANAGED_WAITLIST.inputPlaceholder}
              required
            />
            <Button
              type="submit"
              variant="primary"
              isLoading={status === 'loading'}
              disabled={status === 'loading'}
            >
              {status === 'loading'
                ? FO_MANAGED_WAITLIST.buttonLabelLoading
                : FO_MANAGED_WAITLIST.buttonLabel}
            </Button>
            {status === 'error' && <p className="text-xs text-destructive">{message}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
