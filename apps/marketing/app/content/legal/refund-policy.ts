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
  lastUpdated: 'August 31, 2026',
  intro:
    'This page describes when you can get your money back from RevealUI Studio and how to ask for it. It applies to purchases made directly through revealui.com and admin.revealui.com.',
  notice: {
    variant: 'info' as const,
    title: 'The short version',
    body: 'First purchase, monthly or annual, and Pro Perpetual, gets a full refund within 14 days of the first paid charge, no questions asked. After 14 days there is no prorate. Details below.',
  },
} as const;

export const REFUND_POLICY_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. Perpetual licenses (Pro Perpetual)',
    paragraphs: [
      'You may request a full refund within 14 days of purchase, for any reason, no questions asked. Refunds are processed within 5 business days. Your license key is revoked once the refund is issued.',
      'After the 14-day window, refunds are available only for documented product defects, at our discretion.',
    ],
  },
  {
    heading: '2. Subscriptions (Pro, Max, and Enterprise plans)',
    paragraphs: [
      'You can cancel a subscription at any time. Cancellation takes effect at the end of your current billing period, and there is no pro-rated refund for the unused portion of a billing cycle after the 14-day first-purchase window.',
      'Your first purchase, monthly or annual, is refundable in full if you request it within 14 days of your initial paid charge. After 14 days there is no prorate.',
    ],
  },
  {
    heading: '3. Other one-off purchases',
    paragraphs: [
      'If you bought something through a Studio-confirmed request or invoice that is not a subscription or perpetual license, contact us for a refund. Those orders are not self-serve catalog items.',
    ],
  },
  {
    heading: '4. Services engagements',
    paragraphs: [
      'Invoice services and custom engagements are governed by the Master Service Agreement and Statement of Work for that engagement, not by this policy.',
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
