// Refund policy page content. Schema reused from LegalSection for layout
// consistency with Terms, Privacy, Security, Support, and the SLA page.
//
// The refund window and its conditions are sourced verbatim from the
// owner-decided ADR at .jv:docs/decisions/refund-window.md (Option A,
// confirmed 2026-04-16). Do not change the window or its conditions here
// without first changing the ADR; this file is the public restatement of
// that decision, not an independent source.

import { SITE } from '../site';
import type { LegalSection } from './privacy';

export const REFUND_POLICY_META = {
  title: 'Refund Policy',
  lastUpdated: 'July 12, 2026',
  intro:
    'This page describes when you can get your money back from RevealUI Studio and how to ask for it. It applies to purchases made directly through revealui.com and admin.revealui.com.',
  notice: {
    variant: 'info' as const,
    title: 'The short version',
    body: 'Perpetual licenses get a full refund within 14 days of purchase, no questions asked. Subscriptions get a full refund on your first month if you cancel within 14 days of your first charge. Details below.',
  },
} as const;

export const REFUND_POLICY_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. Perpetual licenses (Pro, Agency, and Enterprise Perpetual)',
    paragraphs: [
      'You may request a full refund within 14 days of purchase, for any reason, no questions asked. Refunds are processed within 5 business days. Your license key is revoked once the refund is issued.',
      'After the 14-day window, refunds are available only for documented product defects, at our discretion.',
    ],
  },
  {
    heading: '2. Subscriptions (Pro, Max, and Enterprise plans)',
    paragraphs: [
      'You can cancel a subscription at any time. Cancellation takes effect at the end of your current billing period, and there is no pro-rated refund for the unused portion of a billing cycle.',
      'Your first month is refundable in full if you request it within 14 days of your initial paid charge.',
    ],
  },
  {
    heading: '3. Starter Kit (content-only product)',
    paragraphs: [
      'The RevealUI Starter Kit is a content product, not a Pro license and not a hosted instance. Self-serve checkout is not public until the first-sale walk is recorded. If you purchased through a Studio-confirmed request or invoice, contact us for a refund. We treat it as a content product.',
    ],
  },
  {
    heading: '4. Services engagements',
    paragraphs: [
      'Architecture Review, Fleet deployment, Custom Build, and other services sold by invoice are governed by the Master Service Agreement and Statement of Work for that engagement, not by this policy.',
    ],
  },
  {
    heading: '5. How to request a refund',
    listItems: [
      `Email ${SITE.emails.founder} with your order number.`,
      'We process eligible refunds within 5 business days of your request.',
      'For a perpetual license, your license key is revoked once the refund is issued.',
    ],
  },
  {
    heading: '6. Contact',
    paragraphs: [`Questions about a specific order or refund go to ${SITE.emails.founder}.`],
    contactEmail: SITE.emails.founder,
  },
];
