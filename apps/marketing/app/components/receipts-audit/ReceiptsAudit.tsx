import { ButtonCVA as Button, Input } from '@revealui/presentation';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import {
  RECEIPTS_AUDIT_BANDS,
  RECEIPTS_AUDIT_FORM,
  RECEIPTS_AUDIT_PROGRESS,
  RECEIPTS_AUDIT_QUESTIONS,
  RECEIPTS_AUDIT_REMEDIATION,
  RECEIPTS_AUDIT_SCORE,
} from '../../content/receipts-audit';
import { submitReceiptsAudit } from '../../lib/api';
import { type AuditAnswer, bandForScore, countReceipts } from '../../lib/receipts-audit';

const TOTAL = RECEIPTS_AUDIT_QUESTIONS.length;

function AnswerButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-w-[4.5rem] rounded-full px-5 py-2 text-sm font-medium transition ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

export function ReceiptsAudit() {
  const [answers, setAnswers] = useState<readonly (AuditAnswer | null)[]>(() =>
    RECEIPTS_AUDIT_QUESTIONS.map(() => null),
  );
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [revealed, setRevealed] = useState(false);

  const answeredCount = useMemo(() => answers.filter((a) => a !== null).length, [answers]);
  const complete = answeredCount === TOTAL;
  const score = useMemo(() => countReceipts(RECEIPTS_AUDIT_QUESTIONS, answers), [answers]);
  const band = RECEIPTS_AUDIT_BANDS[bandForScore(score)];

  function answer(index: number, value: AuditAnswer) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');
    const error = await submitReceiptsAudit({ email, website });
    if (error === null) {
      setStatus('idle');
      setRevealed(true);
    } else {
      setStatus('error');
      setMessage(error);
    }
  }

  return (
    <>
      {/* Questions */}
      <section className="px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <p
            className="text-sm text-muted-foreground"
            aria-live="polite"
            data-testid="audit-progress"
          >
            {RECEIPTS_AUDIT_PROGRESS.prefix} {answeredCount} {RECEIPTS_AUDIT_PROGRESS.suffix}
          </p>

          <ol className="mt-8 space-y-10 list-none p-0">
            {RECEIPTS_AUDIT_QUESTIONS.map((q, index) => (
              <li key={q.id}>
                <fieldset className="flex flex-col gap-4">
                  <legend className="text-base leading-7 text-foreground">
                    <span className="mr-2 font-mono text-sm text-muted-foreground">
                      {String(q.id).padStart(2, '0')}
                    </span>
                    {q.text}
                  </legend>
                  <div className="flex gap-3">
                    <AnswerButton
                      active={answers[index] === 'yes'}
                      onClick={() => answer(index, 'yes')}
                    >
                      {RECEIPTS_AUDIT_PROGRESS.yesLabel}
                    </AnswerButton>
                    <AnswerButton
                      active={answers[index] === 'no'}
                      onClick={() => answer(index, 'no')}
                    >
                      {RECEIPTS_AUDIT_PROGRESS.noLabel}
                    </AnswerButton>
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Result band + email capture, revealed once all twelve are answered. */}
      {complete && (
        <section className="border-t border-border bg-card px-6 py-16 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {RECEIPTS_AUDIT_SCORE.scoreLabel}
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">
              {score} / {TOTAL}{' '}
              <span className="text-2xl font-medium text-muted-foreground">
                {RECEIPTS_AUDIT_SCORE.suffix}
              </span>
            </p>

            <h2 className="mt-8 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {band.headline}
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">{band.body}</p>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row">
              <Button asChild size="lg" variant="primary">
                <a
                  href={band.primaryCta.href}
                  {...(band.primaryCta.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {band.primaryCta.label}
                </a>
              </Button>
              {band.secondaryCta && (
                <Button asChild size="lg" variant="outline">
                  <a
                    href={band.secondaryCta.href}
                    {...(band.secondaryCta.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {band.secondaryCta.label}
                  </a>
                </Button>
              )}
            </div>

            {/* Email capture. Revealing the remediation guide is the payoff. */}
            {!revealed && (
              <div className="mt-16 border-t border-border pt-10">
                <h3 className="text-xl font-semibold text-foreground">
                  {RECEIPTS_AUDIT_FORM.heading}
                </h3>
                <p className="mt-1 text-base text-muted-foreground">
                  {RECEIPTS_AUDIT_FORM.subheading}
                </p>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  {RECEIPTS_AUDIT_FORM.body}
                </p>

                <form onSubmit={handleSubmit} className="mt-6 flex max-w-sm flex-col gap-3">
                  <label htmlFor="receipts-audit-email" className="sr-only">
                    {RECEIPTS_AUDIT_FORM.emailLabel}
                  </label>
                  <Input
                    id="receipts-audit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={RECEIPTS_AUDIT_FORM.emailPlaceholder}
                    required
                  />

                  {/* Honeypot: hidden from humans, tempting to bots. The server
                      silently 200s any submission that fills it. */}
                  <div
                    className="absolute left-[-9999px] h-px w-px overflow-hidden"
                    aria-hidden="true"
                  >
                    <label htmlFor="receipts-audit-website">Website</label>
                    <input
                      id="receipts-audit-website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={status === 'loading'}
                    disabled={status === 'loading'}
                  >
                    {status === 'loading'
                      ? RECEIPTS_AUDIT_FORM.buttonLoadingLabel
                      : RECEIPTS_AUDIT_FORM.buttonLabel}
                  </Button>
                  {status === 'error' && <p className="text-xs text-destructive">{message}</p>}
                </form>
              </div>
            )}

            {revealed && (
              <p className="mt-16 border-t border-border pt-10 text-base font-medium text-primary">
                {RECEIPTS_AUDIT_FORM.successMessage}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Remediation checklist, revealed only after a successful submit. */}
      {revealed && (
        <section className="px-6 py-16 sm:py-20 lg:px-8" data-testid="remediation-guide">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {RECEIPTS_AUDIT_REMEDIATION.heading}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {RECEIPTS_AUDIT_REMEDIATION.intro}
            </p>

            <ol className="mt-10 space-y-8 list-none p-0">
              {RECEIPTS_AUDIT_REMEDIATION.items.map((item) => (
                <li key={item.id} className="rounded-2xl bg-card p-6 ring-1 ring-border">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">
                      {String(item.id).padStart(2, '0')}
                    </span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      {item.primitive}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.gap}</p>
                  <p className="mt-3 text-sm leading-6 text-foreground">{item.fix}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </>
  );
}
