// Sourced from: app/routes/PrivacyPage.tsx (Phase 1, no copy changes). Per the internal marketing-overhaul plan §4.4.

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
  lastUpdated: 'August 13, 2026',
  intro:
    'The RevealUI platform (revealui.com, admin.revealui.com, api.revealui.com, and docs.revealui.com, the "Service") is operated by REVEALUI STUDIO L.L.C., a Tennessee limited liability company ("we", "us", "our"). This Privacy Policy describes how we collect, use, and protect your personal information.',
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
        name: 'Cloudflare R2',
        description: 'object storage (media uploads, generated assets)',
        policyLabel: 'Cloudflare Privacy Policy',
        policyUrl: 'https://www.cloudflare.com/privacypolicy/',
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
    paragraphs: [
      'For the full dated list of subprocessors with regions, data categories, and DPA links, see our Subprocessors page at https://revealui.com/legal/subprocessors. The Subprocessors page is the authoritative source; this section is a summary kept in sync with it.',
    ],
  },
  {
    heading: '4. Customer content and AI training',
    paragraphs: [
      'We do not use customer content (the data, prompts, files, and configurations you submit to the Service) to train any general-purpose model. This commitment applies to any model we operate and to any third-party model accessed through the Service via our infrastructure.',
      'If you connect your own external LLM provider to RevealUI (your own OpenAI key, Anthropic key, or other provider), your data flows to that provider on terms you have agreed to with them. We do not intermediate those terms. You are responsible for understanding their training-data position.',
      'The default RevealUI configuration uses local AI inference (Ollama or Inference Snaps) that runs entirely on your own infrastructure. In that configuration, customer content does not leave your boundary at all.',
    ],
  },
  {
    heading: '5. Data Retention',
    paragraphs: [
      'Account data is retained while your account is active. After account deletion, we permanently remove your personal data within 30 days. Application logs and error events are retained for 90 days. Infrastructure server logs (IP address, request path, user agent) are retained by our hosting provider per their policy. Billing records are retained as required by tax law (typically 7 years).',
    ],
  },
  {
    heading: '6. Your Rights (GDPR / CCPA)',
    listItems: [
      'Access your personal data, available via your account settings or by contacting us',
      'Export your data: use the GDPR export endpoint in the admin',
      'Delete your account and all associated data: use the account deletion feature or contact us',
      'Correct inaccurate data: update your profile in the admin dashboard',
      'Object to processing: contact us at the email below',
    ],
    paragraphs: [
      'California residents: Under the CCPA/CPRA you have the right to know what personal information we collect and to request its deletion. We do not sell or share personal information for cross-context advertising. We honor Global Privacy Control as a request to reject optional cookies.',
    ],
  },
  {
    heading: '7. Security',
    paragraphs: [
      'We protect your data using: bcrypt password hashing, session-based authentication with secure cookies, rate limiting and brute-force protection, HTTPS/TLS encryption in transit, and encrypted database connections.',
    ],
  },
  {
    heading: '8. Cookies and trackers',
    paragraphs: [
      'Necessary cookies (session, role, CSRF, collaborative node id, and the consent cookie itself) run to provide the service. Optional analytics, Speed Insights, and Sentry replay stay off until you accept. Reject all is offered with the same prominence as Accept all. Global Privacy Control and Do Not Track are treated as reject-optional. The full inventory lives on the Cookie Policy at https://revealui.com/cookies.',
    ],
  },
  {
    heading: '9. HIPAA and regulated data',
    paragraphs: [
      'Hosted RevealUI is not a HIPAA-certified environment. Do not put protected health information on it without a signed Business Associate Agreement and the HIPAA configuration (REVEALUI_COMPLIANCE_PROFILE=hipaa). That profile turns optional telemetry off and signs idle admin sessions out after 15 minutes. Details: https://revealui.com/legal/hipaa.',
    ],
  },
  {
    heading: '10. Children',
    paragraphs: [
      'The Service is not intended for children under 13. We do not knowingly collect personal information from children under 13.',
    ],
  },
  {
    heading: '11. Changes',
    paragraphs: [
      'We may update this Privacy Policy from time to time. We will notify registered users of material changes via email.',
    ],
  },
  {
    heading: '12. Contact',
    paragraphs: [
      `For privacy-related questions or to exercise your data rights, contact us at ${SITE.emails.support}.`,
    ],
    contactEmail: SITE.emails.support,
  },
];
