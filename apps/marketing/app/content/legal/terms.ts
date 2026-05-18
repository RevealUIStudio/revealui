// Sourced from: app/routes/TermsPage.tsx (Phase 1, no copy changes). Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { SITE } from '../site';
import type { LegalSection } from './privacy';

export const TERMS_META = {
  title: 'Terms of Service',
  lastUpdated: 'March 4, 2026',
  intro:
    'These Terms of Service ("Terms") govern your use of the RevealUI platform provided by REVEALUI STUDIO L.L.C., a Tennessee limited liability company ("we", "us", "our"). By creating an account or using the Service, you agree to these Terms.',
} as const;

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. Service Description',
    paragraphs: [
      'RevealUI is an open-source agentic business runtime for software companies. It includes a content engine, authentication, billing integration, AI agents, and UI components. The Service is available in four tiers: Free (OSS), Pro, Max, and Enterprise.',
    ],
  },
  {
    heading: '2. Accounts',
    listItems: [
      'You must provide accurate information when creating an account.',
      'You are responsible for maintaining the security of your account credentials.',
      'You must be at least 13 years old to use the Service.',
      'One person or organization may not maintain more than one free account.',
    ],
  },
  {
    heading: '3. Free Tier (OSS)',
    paragraphs: [
      'The Free tier is licensed under the MIT License. You may use, modify, and distribute the open-source code freely, subject to the MIT License terms. The Free tier includes limited features (1 site, 3 users, community support).',
    ],
  },
  {
    heading: '4. Paid Tiers (Pro, Max & Enterprise)',
    subsections: [
      {
        heading: 'Billing',
        listItems: [
          'Pro: $49/month, billed monthly. Includes a 7-day free trial.',
          'Max: $149/month, billed monthly. Includes a 7-day free trial.',
          'Enterprise: $299/month, billed monthly. Contact sales for annual pricing.',
          'All prices are in USD and exclude applicable taxes.',
          "Payment is processed by Stripe. You agree to Stripe's terms of service.",
        ],
      },
      {
        heading: 'Trial',
        paragraph:
          'The Pro tier includes a 7-day free trial. You will not be charged during the trial period. If you do not cancel before the trial ends, your subscription will automatically begin and you will be charged the applicable monthly rate.',
      },
      {
        heading: 'Cancellation',
        paragraph:
          'You may cancel your subscription at any time through the Stripe billing portal or by contacting us. Cancellation takes effect at the end of your current billing period. You retain access to paid features until then.',
      },
      {
        heading: 'Refunds',
        paragraph: `We offer a full refund if requested within 14 days of your first paid charge (not including the trial period). After 14 days, no refunds are issued for partial billing periods. Contact ${SITE.emails.support} for refund requests.`,
      },
    ],
  },
  {
    heading: '5. Commercial License',
    paragraphs: [
      'Pro packages (@revealui/ai and @revealui/harnesses) are commercially licensed. The license is granted per-subscription and is non-transferable. See LICENSE.commercial in the repository for full terms.',
    ],
  },
  {
    heading: '6. Acceptable Use',
    listPreamble: 'You agree not to:',
    listItems: [
      'Use the Service for any unlawful purpose',
      'Attempt to gain unauthorized access to the Service or its infrastructure',
      'Distribute malware, spam, or harmful content through the Service',
      'Exceed reasonable usage limits or abuse API rate limits',
      'Resell Pro/Max/Enterprise features without a valid license',
      'Reverse-engineer, decompile, or circumvent license key validation',
    ],
    paragraphs: ['We reserve the right to suspend or terminate accounts that violate these terms.'],
  },
  {
    heading: '7. Data and Content',
    listItems: [
      'You retain ownership of all content you create using the Service.',
      'We do not claim any intellectual property rights over your content.',
      'You are responsible for maintaining backups of your data. While we use reliable hosting providers, we do not guarantee against data loss.',
      'For self-hosted deployments, you are responsible for your own data security and compliance.',
    ],
  },
  {
    heading: '8. Service Availability',
    paragraphs: [
      'We strive for high availability but do not guarantee uninterrupted service. The Service is provided "as is" without warranty of any kind, express or implied. We are not liable for any downtime, data loss, or damages resulting from use of the Service.',
    ],
  },
  {
    heading: '9. Limitation of Liability',
    paragraphs: [
      'To the maximum extent permitted by law, REVEALUI STUDIO L.L.C. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities. Our total liability under these Terms shall not exceed the amount paid by you to us in the 12 months preceding the claim.',
    ],
  },
  {
    heading: '10. Changes to Terms',
    paragraphs: [
      'We may update these Terms from time to time. We will notify registered users of material changes via email at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the new Terms.',
    ],
  },
  {
    heading: '11. Governing Law',
    paragraphs: [
      'These Terms are governed by the laws of the State of Tennessee, United States, without regard to its conflict-of-laws provisions. Any disputes shall be resolved in the state or federal courts located in Tennessee.',
    ],
  },
  {
    heading: '12. Contact',
    paragraphs: [`For questions about these Terms, contact us at ${SITE.emails.support}.`],
    contactEmail: SITE.emails.support,
  },
];
