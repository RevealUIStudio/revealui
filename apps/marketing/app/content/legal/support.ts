// Support page content. Schema reused from LegalSection for layout
// consistency with the other trust pages.

import { SITE } from '../site';
import type { LegalSection } from './privacy';

export const SUPPORT_META = {
  title: 'Support',
  lastUpdated: 'May 28, 2026',
  intro:
    'RevealUI Studio is a solo-operator company. We want to help you succeed with RevealUI, and we want to be honest about what kind of help we can offer, on what timeline, and through which channels. This page covers all three.',
} as const;

export const SUPPORT_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. Choose your channel',
    listPreamble: 'Different questions land best in different places. In rough order of speed:',
    listItems: [
      `**Documentation** at https://docs.revealui.com: covers setup, configuration, the API surface, and most "how do I do X with RevealUI" questions. Always check here first; if the answer is there, you have it now instead of in 48 hours.`,
      `**GitHub Discussions** at https://github.com/RevealUIStudio/revealui/discussions: community-friendly format for design questions, "is there a better way to do X", and ideas. Other users and the maintainer both watch this. Best for questions where a public answer benefits more than just you.`,
      `**GitHub Issues** at https://github.com/RevealUIStudio/revealui/issues: for confirmed bugs and feature requests. Include reproduction steps. See §5 below for "bug vs support" guidance.`,
      `**Email** at ${SITE.emails.support}: for account-specific issues (billing, license keys, your data), security concerns, and questions you cannot ask in public.`,
    ],
  },
  {
    heading: '2. Response SLA',
    paragraphs: [
      `Email to ${SITE.emails.support}: we aim for a substantive response within **48 business hours** (Monday through Friday, U.S. Central Time, excluding U.S. federal holidays). Acknowledgement is usually faster, within one business day, and complex issues may require multiple rounds of correspondence.`,
      'GitHub Issues and Discussions: best-effort. We read them, but we may not respond instantly. If something is urgent, email is the right channel.',
      'Security reports: see the dedicated security policy at https://revealui.com/security. Those go to a separate address with separate SLAs.',
    ],
  },
  {
    heading: '3. What we can help with',
    listItems: [
      'Setup and installation issues with `create-revealui` and the published packages',
      'Configuration questions about the admin engine, auth, billing integration, or AI agents',
      'License key issues (lost keys, transfer, downgrade, refund within window)',
      'Bugs in the published RevealUI source code (OSS and Pro packages)',
      'Questions about the documented API surface',
      'Account changes, plan changes, and cancellations',
      'Genuine "is RevealUI the right tool for X" pre-purchase questions',
    ],
  },
  {
    heading: '4. What we cannot help with',
    paragraphs: [
      'We need to be honest about scope. A solo-operator support model only works if we say "no" to the things that would consume all our time without serving customers fairly.',
    ],
    listItems: [
      'We do not write your application code for you. RevealUI is a framework; you build with it.',
      'We do not review private codebases line by line. Public GitHub repos we can sometimes glance at; private repos require an Enterprise engagement (see Pricing).',
      'We do not debug deployments to specific hosting environments (Kubernetes clusters, exotic Docker setups, customer VPNs) beyond the documented Vercel / Fly / Hetzner / Docker paths.',
      'We cannot recover data from a self-hosted instance that has been lost. We do not have access to your database. Always maintain your own backups.',
      'We do not provide free architectural consulting outside the documented patterns. Track D professional services (when published) is the right channel for that.',
      'We do not provide live phone or video support at the Pro tier. Email-and-async only.',
    ],
  },
  {
    heading: '5. When to file a bug vs ask for support',
    listPreamble: 'A useful rule of thumb when deciding where to take an issue:',
    listItems: [
      `**File a bug** (GitHub Issue) when: the documented behavior does not match the actual behavior; you have a reliable reproduction; the issue would affect other users; the fix probably lives in the public source code.`,
      `**Email support** (${SITE.emails.support}) when: the issue is specific to your account or data; the issue involves a license, billing question, or refund; the issue is sensitive; you do not yet have a reproduction but something feels wrong.`,
      `**Open a Discussion** when: you are not sure if it is a bug; you want input from the community; you want to influence the roadmap.`,
    ],
  },
  {
    heading: '6. Status and uptime',
    paragraphs: [
      'Live status of revealui.com, admin.revealui.com, api.revealui.com, and docs.revealui.com is published at https://revealui.com/status with a live probe of the API health endpoint and an honest disclosure of our monitoring posture (we are a solo-operator company; we do not run 24×7 manned monitoring).',
      'If you are experiencing an outage that the status page does not yet reflect, email support and include the surface you are hitting and the time you first saw the issue.',
    ],
  },
  {
    heading: '7. Premium support',
    paragraphs: [
      'The published pricing page describes the response targets for the Pro tier (48 business hours), Max tier (24 business hours), and Enterprise tier (4-hour Slack SLA). These targets are aspirational at launch and we will publish the actual achieved response times once we have data. We would rather measure honestly than over-promise.',
      'Enterprise customers who need a dedicated Slack channel, a named technical contact, or scheduled architecture reviews should contact us before purchase to confirm scope and timeline.',
    ],
  },
  {
    heading: '8. Contact',
    paragraphs: [
      `For support questions, email ${SITE.emails.support}. For account-specific or sensitive matters, you can also reach the founder directly at ${SITE.emails.founder}.`,
    ],
    contactEmail: SITE.emails.support,
  },
];
