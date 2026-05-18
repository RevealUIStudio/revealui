// Sourced from: app/routes/PrivacyPage.tsx (Phase 1, no copy changes). Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { SITE } from '../site';

export interface LegalSection {
  readonly heading: string;
  readonly subsections?: readonly LegalSubsection[];
  readonly listPreamble?: string;
  readonly paragraphs?: readonly string[];
  readonly listItems?: readonly string[];
  readonly thirdParties?: readonly ThirdParty[];
  readonly contactEmail?: string;
}

export interface LegalSubsection {
  readonly heading: string;
  readonly paragraph?: string;
  readonly listItems?: readonly string[];
}

export interface ThirdParty {
  readonly name: string;
  readonly description: string;
  readonly policyLabel: string;
  readonly policyUrl: string;
  readonly extra?: string;
}

export const PRIVACY_META = {
  title: 'Privacy Policy',
  lastUpdated: 'April 22, 2026',
  intro:
    'The RevealUI platform (revealui.com, admin.revealui.com, api.revealui.com, and docs.revealui.com — the "Service") is operated by REVEALUI STUDIO L.L.C., a Tennessee limited liability company ("we", "us", "our"). This Privacy Policy describes how we collect, use, and protect your personal information.',
} as const;

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. Information We Collect',
    subsections: [
      {
        heading: 'Account Information',
        paragraph:
          'When you create an account, we collect your email address, name, and password (stored as a bcrypt hash). If you sign up via OAuth (Google, GitHub), we receive your provider profile information.',
      },
      {
        heading: 'Payment Information',
        paragraph:
          'Payment processing is handled entirely by Stripe. We never store credit card numbers. We store your Stripe customer ID to link your account to your subscription.',
      },
      {
        heading: 'Usage Data',
        paragraph:
          'We collect server logs (IP address, request path, user agent) for security monitoring and debugging. See §4 below for retention windows.',
      },
      {
        heading: 'Content Data',
        paragraph:
          'Any content you create through the admin (posts, pages, media) is stored in your database. For hosted plans, this data is stored in NeonDB (PostgreSQL).',
      },
    ],
  },
  {
    heading: '2. How We Use Your Information',
    listItems: [
      'To provide and maintain the Service',
      'To process payments and manage subscriptions',
      'To send transactional emails (password resets, billing notifications, license delivery)',
      'To detect and prevent fraud, abuse, and security incidents',
      'To diagnose application errors using error telemetry (Sentry). When an error occurs, a partial session recording of the moments preceding the crash may be captured to aid debugging. No proactive or continuous session recording is performed.',
      'To respond to support requests',
    ],
    paragraphs: [
      'We do not sell your personal information. We do not use your data for advertising.',
    ],
  },
  {
    heading: '3. Data Sharing',
    listPreamble: 'We share data only with:',
    thirdParties: [
      {
        name: 'Stripe',
        description: 'for payment processing',
        policyLabel: 'Stripe Privacy Policy',
        policyUrl: 'https://stripe.com/privacy',
      },
      {
        name: 'NeonDB',
        description: 'database hosting',
        policyLabel: 'Neon Privacy Policy',
        policyUrl: 'https://neon.tech/privacy',
      },
      {
        name: 'Vercel',
        description: 'application hosting',
        policyLabel: 'Vercel Privacy Policy',
        policyUrl: 'https://vercel.com/legal/privacy-policy',
      },
      {
        name: 'Google Workspace',
        description: 'transactional email delivery via Gmail API',
        policyLabel: 'Google Privacy Policy',
        policyUrl: 'https://policies.google.com/privacy',
      },
      {
        name: 'Sentry',
        description: 'application error tracking and crash-replay diagnostics',
        policyLabel: 'Sentry Privacy Policy',
        policyUrl: 'https://sentry.io/privacy/',
        extra:
          'Error data may include browser context, page URL, and a partial session recording captured at the time of an error. No continuous session recording is performed.',
      },
    ],
  },
  {
    heading: '4. Data Retention',
    paragraphs: [
      'Account data is retained while your account is active. After account deletion, we permanently remove your personal data within 30 days. Application logs and error events are retained for 90 days. Agent activity audit logs are retained indefinitely for security and compliance purposes. Infrastructure server logs (IP address, request path, user agent) are retained by our hosting provider per their policy. Billing records are retained as required by tax law (typically 7 years).',
    ],
  },
  {
    heading: '5. Your Rights (GDPR / CCPA)',
    listItems: [
      'Access your personal data, available via your account settings or by contacting us',
      'Export your data: use the GDPR export endpoint in the admin',
      'Delete your account and all associated data: use the account deletion feature or contact us',
      'Correct inaccurate data: update your profile in the admin dashboard',
      'Object to processing: contact us at the email below',
    ],
    paragraphs: [
      'California residents: Under the CCPA, you have the right to know what personal information we collect and to request its deletion. We do not sell personal information.',
    ],
  },
  {
    heading: '6. Security',
    paragraphs: [
      'We protect your data using: bcrypt password hashing, session-based authentication with secure cookies, rate limiting and brute-force protection, HTTPS/TLS encryption in transit, and encrypted database connections.',
    ],
  },
  {
    heading: '7. Cookies',
    paragraphs: [
      'We use essential cookies only: a session cookie for authentication. We do not use tracking cookies, analytics cookies, or advertising cookies.',
    ],
  },
  {
    heading: '8. Children',
    paragraphs: [
      'The Service is not intended for children under 13. We do not knowingly collect personal information from children under 13.',
    ],
  },
  {
    heading: '9. Changes',
    paragraphs: [
      'We may update this Privacy Policy from time to time. We will notify registered users of material changes via email.',
    ],
  },
  {
    heading: '10. Contact',
    paragraphs: [
      `For privacy-related questions or to exercise your data rights, contact us at ${SITE.emails.support}.`,
    ],
    contactEmail: SITE.emails.support,
  },
];
