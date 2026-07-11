// Content for the Agent Receipts Audit lead magnet (/receipts-audit).
//
// A twelve-question yes/no self-assessment that scores as the visitor answers,
// bands the result, and captures an email against the waitlist (source
// 'receipts-audit', a LEAD source). After a successful submit the remediation
// checklist below is revealed inline.
//
// Copy is owner-authored verbatim for the title, subhead, questions, and score
// bands. The remediation items themselves (title/gap/fix, one per question)
// are NOT owned here: they live in @revealui/contracts/receipts-audit, the
// single source of truth also consumed by apps/server's confirmation email
// (precedent: ARCHITECTURE_REVIEW_PRICE in @revealui/contracts/pricing). This
// file only wraps that array with the page-specific heading + intro. No em
// dashes (owner style); voice-and-headline rules apply (validated by
// scripts/validate/marketing-voice.ts).

import { RECEIPTS_AUDIT_REMEDIATION_ITEMS } from '@revealui/contracts/receipts-audit';
import type { AuditAnswer, BandId } from '../lib/receipts-audit';
import { SITE } from './site';
import type { Cta } from './types';

/** External booking link for the Architecture Review call. */
const ARCHITECTURE_REVIEW_URL = 'https://cal.com/revealuistudio/discovery' as const;

const START_FREE: Cta = { label: 'Start free', href: SITE.urls.signup };
const BOOK_REVIEW: Cta = {
  label: 'Book the Architecture Review',
  href: ARCHITECTURE_REVIEW_URL,
  external: true,
};

export interface AuditQuestion {
  readonly id: number;
  readonly text: string;
  /** The answer that scores as a receipt. Defaults to 'yes' for all but Q5. */
  readonly positiveAnswer: AuditAnswer;
}

export const RECEIPTS_AUDIT_QUESTIONS: readonly AuditQuestion[] = [
  {
    id: 1,
    text: 'Can you list every action an AI agent took in your business last week?',
    positiveAnswer: 'yes',
  },
  {
    id: 2,
    text: "Does every agent act as its own user with its own identity, separate from any human's credentials?",
    positiveAnswer: 'yes',
  },
  {
    id: 3,
    text: "Could you revoke one agent's access right now without breaking anything else?",
    positiveAnswer: 'yes',
  },
  {
    id: 4,
    text: 'When an agent changes content, can you see exactly what changed and roll it back?',
    positiveAnswer: 'yes',
  },
  {
    id: 5,
    text: 'Can an agent spend money today without hitting a limit you set?',
    // A "yes" here means there is no ceiling, which is the gap. "No" is the receipt.
    positiveAnswer: 'no',
  },
  {
    id: 6,
    text: 'Do you know which AI provider processed your customer data this month?',
    positiveAnswer: 'yes',
  },
  {
    id: 7,
    text: 'If a customer asked "did a human or an agent send this?", could you answer with evidence?',
    positiveAnswer: 'yes',
  },
  {
    id: 8,
    text: 'Are your agent prompts and policies written down and versioned where a reviewer could read them?',
    positiveAnswer: 'yes',
  },
  {
    id: 9,
    text: 'Could you pause every agent from one place in under a minute?',
    positiveAnswer: 'yes',
  },
  {
    id: 10,
    text: 'Do your agents run on infrastructure you control?',
    positiveAnswer: 'yes',
  },
  {
    id: 11,
    text: 'When an agent fails, does something alert a human before a customer notices?',
    positiveAnswer: 'yes',
  },
  {
    id: 12,
    text: 'If you were audited tomorrow, could you produce a log of agent activity in minutes rather than days?',
    positiveAnswer: 'yes',
  },
] as const;

export const RECEIPTS_AUDIT_HERO = {
  eyebrow: 'Self-assessment',
  title: 'The Agent Receipts Audit',
  subhead:
    "If an agent did it, there's a receipt. Twelve questions that show whether that is true for your business. Five minutes, scored as you go.",
} as const;

export const RECEIPTS_AUDIT_PROGRESS = {
  /** Rendered as `Answered {n} of 12`. */
  prefix: 'Answered',
  suffix: 'of 12',
  yesLabel: 'Yes',
  noLabel: 'No',
} as const;

export interface AuditBand {
  readonly headline: string;
  readonly body: string;
  readonly primaryCta: Cta;
  readonly secondaryCta?: Cta;
}

export const RECEIPTS_AUDIT_BANDS: Readonly<Record<BandId, AuditBand>> = {
  strong: {
    headline: 'You have receipts.',
    body: 'You are ahead of nearly every team running agents today. See how far the runtime takes the rest.',
    primaryCta: START_FREE,
  },
  partial: {
    headline: 'You have partial receipts.',
    body: 'Your agents work, but you could not prove everything they did. The gaps you just found are exactly what a governed runtime closes.',
    primaryCta: START_FREE,
    secondaryCta: BOOK_REVIEW,
  },
  trust: {
    headline: 'You are running on trust.',
    body: 'Nothing here is unusual, but none of it survives an audit or an incident. Fixing this is a two week project, not a rewrite.',
    primaryCta: BOOK_REVIEW,
    secondaryCta: START_FREE,
  },
} as const;

/** The score band shown as a fraction, e.g. "8 / 12 receipts". */
export const RECEIPTS_AUDIT_SCORE = {
  suffix: 'receipts',
  scoreLabel: 'Your score',
} as const;

export const RECEIPTS_AUDIT_FORM = {
  heading: 'Get the full checklist',
  subheading: 'The fix for every gap you found.',
  body: 'Enter your email and we will show the remediation guide for all twelve receipts, and send you a copy.',
  emailLabel: 'Email address',
  emailPlaceholder: 'you@company.com',
  buttonLabel: 'Send it',
  buttonLoadingLabel: 'Sending…',
  successMessage: 'Here is the remediation guide. A copy is on its way to your inbox.',
} as const;

export type { RemediationItem, RuntimePrimitive } from '@revealui/contracts/receipts-audit';

export const RECEIPTS_AUDIT_REMEDIATION = {
  heading: 'The remediation guide',
  intro:
    'One fix per receipt, mapped to the runtime primitive that closes it. Read it here, and check your inbox for a copy.',
  items: RECEIPTS_AUDIT_REMEDIATION_ITEMS,
} as const;
