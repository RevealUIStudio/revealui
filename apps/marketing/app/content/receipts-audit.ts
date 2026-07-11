// Content for the Agent Receipts Audit lead magnet (/receipts-audit).
//
// A twelve-question yes/no self-assessment that scores as the visitor answers,
// bands the result, and captures an email against the waitlist (source
// 'receipts-audit', a LEAD source). After a successful submit the remediation
// checklist below is revealed inline.
//
// Copy is owner-authored verbatim for the title, subhead, questions, and score
// bands. The remediation checklist is written in the same voice, mapping each
// gap to a runtime primitive (People / Content / Offers / Payments / Agents)
// and a concrete mechanism. No em dashes (owner style); voice-and-headline
// rules apply (validated by scripts/validate/marketing-voice.ts).

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
    text: "Does every agent act as its own user with its own identity, or do your agents share a human's credentials?",
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

export type RuntimePrimitive = 'People' | 'Content' | 'Offers' | 'Payments' | 'Agents';

export interface RemediationItem {
  /** Maps 1:1 to the question of the same id. */
  readonly id: number;
  readonly primitive: RuntimePrimitive;
  readonly title: string;
  readonly gap: string;
  readonly fix: string;
}

export const RECEIPTS_AUDIT_REMEDIATION = {
  heading: 'The remediation guide',
  intro:
    'One fix per receipt, mapped to the runtime primitive that closes it. Read it here, and check your inbox for a copy.',
  items: [
    {
      id: 1,
      primitive: 'Agents',
      title: 'List every action from last week',
      gap: 'You cannot reconstruct last week because agent actions were never written to one durable place.',
      fix: 'Every agent action signs into a tamper-evident audit log, so a full week of activity is one query away.',
    },
    {
      id: 2,
      primitive: 'People',
      title: 'Give every agent its own identity',
      gap: 'Agents that borrow a human login are invisible in your records and impossible to tell apart.',
      fix: 'Each agent becomes its own governed user with its own identity, so every action traces back to the exact actor.',
    },
    {
      id: 3,
      primitive: 'People',
      title: 'Revoke one agent without collateral damage',
      gap: 'Shared credentials mean pulling one agent breaks the humans and agents sitting next to it.',
      fix: 'Per-agent identity lets you revoke one agent in a click, with no collateral outage.',
    },
    {
      id: 4,
      primitive: 'Content',
      title: 'See and undo what an agent changed',
      gap: 'A content change with no history is a change you can neither review nor undo.',
      fix: 'Content edits are versioned, so you see the exact diff an agent made and roll it back.',
    },
    {
      id: 5,
      primitive: 'Payments',
      title: 'Cap what an agent can spend',
      gap: 'An agent that can spend without a ceiling is an incident waiting to bill you.',
      fix: 'A spend limit caps each agent, and the runtime blocks the transaction that would cross it.',
    },
    {
      id: 6,
      primitive: 'Agents',
      title: 'Know which provider saw your data',
      gap: 'If you cannot name the provider that saw your customer data, you cannot answer for where it went.',
      fix: 'You choose the AI provider per workload, and the runtime records which one handled each request.',
    },
    {
      id: 7,
      primitive: 'Agents',
      title: 'Prove who sent it',
      gap: 'Without a record of who acted, human versus agent is a guess.',
      fix: 'Every message carries the identity that produced it, so you answer a customer with the record, not a hunch.',
    },
    {
      id: 8,
      primitive: 'Content',
      title: 'Version your prompts and policies',
      gap: "Prompts and policies kept in someone's head cannot be reviewed or rolled back.",
      fix: 'Prompts and policies live as versioned records a reviewer can read, compare, and revert.',
    },
    {
      id: 9,
      primitive: 'Agents',
      title: 'Pause everything at once',
      gap: 'If pausing agents means chasing processes, you cannot stop an incident fast enough.',
      fix: 'One kill switch pauses every agent at once, in seconds, from a single screen.',
    },
    {
      id: 10,
      primitive: 'Agents',
      title: 'Run agents on your own infrastructure',
      gap: "Agents on someone else's infrastructure put your data and your controls outside your reach.",
      fix: 'The runtime is self-hosted, so agents run on infrastructure you control and the data stays with you.',
    },
    {
      id: 11,
      primitive: 'Agents',
      title: 'Hear about a failure before your customer does',
      gap: 'A silent failure is one your customer reports before you do.',
      fix: 'A failed agent action raises an alert to a human first, so you reach the customer before the complaint does.',
    },
    {
      id: 12,
      primitive: 'Agents',
      title: 'Produce the log in minutes',
      gap: 'An audit that takes days of log-digging is an audit you are not ready for.',
      fix: 'A hash-chained activity log exports in minutes, so an auditor gets a clean record on the day they ask.',
    },
  ] as readonly RemediationItem[],
} as const;
