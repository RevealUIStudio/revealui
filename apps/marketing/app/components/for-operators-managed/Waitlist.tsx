import { type BlockAnnotation, Button, fieldAttrs, Input } from '@revealui/presentation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { FO_MANAGED_WAITLIST } from '../../content/for-operators-managed';
import { submitWaitlist } from '../../lib/api';
import type { FoManagedWaitlistData } from '../../lib/page-blocks';

export interface FoManagedWaitlistProps {
  readonly data?: FoManagedWaitlistData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function Waitlist({ data, path, annotation }: FoManagedWaitlistProps = {}) {
  const content = data ?? {
    eyebrow: FO_MANAGED_WAITLIST.eyebrow,
    heading: FO_MANAGED_WAITLIST.heading,
    body: FO_MANAGED_WAITLIST.body,
    inputPlaceholder: FO_MANAGED_WAITLIST.inputPlaceholder,
    buttonLabel: FO_MANAGED_WAITLIST.buttonLabel,
    buttonLabelLoading: FO_MANAGED_WAITLIST.buttonLabelLoading,
    successMessage: FO_MANAGED_WAITLIST.successMessage,
  };
  // product source is API contract — never CMS-editable.
  const product = FO_MANAGED_WAITLIST.product;
  const ann = annotation ?? {};
  const base = path ?? '';

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');
    // Source-tagged so RevealUI Cloud interest is queryable separately from
    // newsletter signups (apps/server POST /api/waitlist → waitlist table).
    const error = await submitWaitlist({ email, source: product });
    if (error === null) {
      setStatus('success');
      setMessage(content.successMessage);
      setEmail('');
    } else {
      setStatus('error');
      setMessage(error);
    }
  }

  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
        <p
          className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
          {...(base ? fieldAttrs(ann, `${base}.eyebrow`) : {})}
        >
          {content.eyebrow}
        </p>
        <h2
          className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          {...(base ? fieldAttrs(ann, `${base}.heading`) : {})}
        >
          {content.heading}
        </h2>

        <p
          className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground"
          {...(base ? fieldAttrs(ann, `${base}.body`) : {})}
        >
          {content.body}
        </p>

        {status === 'success' ? (
          <p
            className="mt-10 animate-[fade-in_300ms_ease-out] text-base font-medium text-primary"
            {...(base ? fieldAttrs(ann, `${base}.items.3.body`) : {})}
          >
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
              placeholder={content.inputPlaceholder}
              required
            />
            {/* Labels ride CMS for seed/fallback parity; form controls stay unannotated. */}
            <span className="sr-only" {...(base ? fieldAttrs(ann, `${base}.items.0.body`) : {})}>
              {content.inputPlaceholder}
            </span>
            <Button
              type="submit"
              variant="brand"
              isLoading={status === 'loading'}
              disabled={status === 'loading'}
            >
              <span
                {...(base
                  ? fieldAttrs(
                      ann,
                      status === 'loading' ? `${base}.items.2.body` : `${base}.items.1.body`,
                    )
                  : {})}
              >
                {status === 'loading' ? content.buttonLabelLoading : content.buttonLabel}
              </span>
            </Button>
            {status === 'error' && <p className="text-xs text-destructive">{message}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
