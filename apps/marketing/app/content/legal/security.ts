// Security policy page content. Schema reused from LegalSection for layout
// consistency with TermsPage + PrivacyPage; the page itself is a trust
// signal, not a contract, but the long-form prose-article rendering is the
// same shape.

import { SITE } from '../site';
import type { LegalSection } from './privacy';

export const SECURITY_META = {
  title: 'Security',
  lastUpdated: 'May 28, 2026',
  intro:
    'RevealUI Studio is a solo-operator company building production software. Security is not a marketing line for us — it is a discipline we apply every day, and it determines whether real customers can trust us with their data. This page describes how we accept vulnerability reports, what we commit to in return, and the security posture our customers inherit when they self-host.',
} as const;

export const SECURITY_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. Reporting a vulnerability',
    paragraphs: [
      `If you believe you have found a security vulnerability in RevealUI or any of our hosted properties (revealui.com, admin.revealui.com, api.revealui.com, docs.revealui.com), email ${SITE.emails.security} with a clear description, reproduction steps, and the affected URL or component. If you need a backup address, use ${SITE.emails.founder}.`,
      'We do not currently publish a PGP key. If your report contains sensitive material (proof-of-concept payloads, user data exposure, exploit details), email us first and we will arrange an encrypted channel before you share specifics.',
      'We acknowledge receipt within 2 business days and aim to provide a substantive initial response within 5 business days. As a solo-operator company we cannot promise 24×7 triage, but we treat real security reports as our highest priority.',
    ],
  },
  {
    heading: '2. Our commitment to good-faith researchers',
    listPreamble: 'If you act in good faith and follow this policy, we commit to:',
    listItems: [
      'Not pursue or support legal action against you for your research.',
      'Not contact law enforcement or your employer about your report.',
      'Work with you to understand and resolve the issue without unnecessary delay.',
      'Credit you publicly on this page when the issue is resolved, if you wish to be named. We will never publish your identity without your consent.',
    ],
    paragraphs: [
      'We do not currently run a paid bug-bounty program. We are pre-revenue and cannot honestly promise bounty payouts that we may not be able to fund. If you find a material issue we will discuss recognition, swag, or — once we are revenue-generating — a discretionary reward.',
    ],
  },
  {
    heading: '3. Scope',
    listPreamble: 'In scope:',
    listItems: [
      'revealui.com (marketing site)',
      'admin.revealui.com (admin dashboard)',
      'api.revealui.com (REST API)',
      'docs.revealui.com (documentation site)',
      'The published source code in the RevealUIStudio organization on GitHub',
    ],
  },
  {
    heading: '4. Out of scope',
    listItems: [
      'Third-party services we use (Vercel, NeonDB, Stripe, Cloudflare, etc.) — report directly to those vendors.',
      'Social-engineering attacks against employees, contractors, or customers.',
      'Denial-of-service attacks, traffic flooding, or any test that affects availability.',
      'Vulnerabilities in software you have self-hosted using RevealUI but modified — please report against an unmodified build.',
      'Findings that require physical access to a device we do not own.',
      'Reports of missing security headers without a demonstrated exploit.',
      'Reports based solely on automated-scanner output without manual verification.',
    ],
  },
  {
    heading: '5. What we will not do',
    listItems: [
      'We will not silently fix issues without notifying the reporter when a fix ships.',
      'We will not delay disclosure indefinitely to avoid embarrassment. We aim to publish a brief notice within 90 days of resolution, or sooner if the issue has been independently disclosed.',
      'We will not retaliate against researchers who follow this policy.',
    ],
  },
  {
    heading: '6. Our security posture (summary)',
    paragraphs: [
      'Customers who run RevealUI inherit a security baseline we take seriously. The current posture, in plain English:',
    ],
    listItems: [
      'Authentication uses session cookies signed with a server-side secret, with bcrypt password hashing (cost factor 12), brute-force protection, and rate limiting.',
      'Authorization is enforced by an RBAC + ABAC policy engine with database-level access checks on every collection operation.',
      'Encryption for sensitive fields uses AES-256-GCM with non-extractable keys by default.',
      'Standard browser security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) are configured on every deployed app.',
      'Continuous integration runs CodeQL, Gitleaks, dependency auditing, and an AST-based code-pattern analyzer on every push.',
      'GitHub branch protection requires CI passage before merge to main; production deploys are gated on the deploy workflow, not direct pushes.',
      'Internal security documentation — incident response runbook, information security policy, credential rotation runbook — is maintained alongside this site and available for customer review on request.',
    ],
  },
  {
    heading: '7. Compliance',
    paragraphs: [
      'RevealUI Studio is a Tennessee LLC operating as a solo-operator company. We do not currently hold SOC 2, ISO 27001, or PCI DSS attestations. These are planned for later phases of the company; we will publish progress on this page when those audits begin.',
      'For data protection: we are GDPR-aware in our framework design (consent, deletion, anonymization primitives are in the platform), but a Data Processing Agreement template is not yet finalized for EU B2B customers. If you require a DPA before purchase, contact us before signing up.',
    ],
  },
  {
    heading: '8. Machine-readable policy',
    paragraphs: [
      'This policy is also published as an RFC 9116 security.txt file at https://revealui.com/.well-known/security.txt. Automated security tooling should read that file for contact and policy URLs.',
    ],
  },
  {
    heading: '9. Hall of fame',
    paragraphs: [
      'We will list researchers here as they are credited. The list is empty today — pre-launch — but we plan to keep it updated as the program runs.',
    ],
  },
  {
    heading: '10. Contact',
    paragraphs: [
      `For security questions or to submit a report, contact us at ${SITE.emails.security}.`,
    ],
    contactEmail: SITE.emails.security,
  },
];
