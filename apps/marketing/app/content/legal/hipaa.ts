import { SITE } from '../site';
import type { LegalSection } from './privacy';

export const HIPAA_META = {
  title: 'HIPAA',
  lastUpdated: 'August 13, 2026',
  intro:
    'This page states what RevealUI does, and does not do, for HIPAA. We do not claim that RevealUI Cloud or a default self-host is HIPAA certified. The HIPAA configuration turns on technical controls a covered entity can use. We will sign a Business Associate Agreement when counsel has one ready and the deployment is in that configuration.',
  notice: {
    variant: 'warning' as const,
    title: 'Not a certification',
    body: 'This page does not claim that RevealUI is HIPAA certified. It describes the technical controls in the product and the contract steps that are still required. Counsel questions:',
  },
} as const;

export const HIPAA_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. What this is',
    paragraphs: [
      'HIPAA applies when a covered entity or business associate creates, receives, maintains, or transmits protected health information. RevealUI is general-purpose software. It becomes a HIPAA surface only if you put PHI in it.',
      'Do not send PHI to hosted RevealUI (admin.revealui.com, api.revealui.com) until a signed BAA is in place and the tenant is running the HIPAA configuration. The Studio MSA already says that, absent a HIPAA addendum, customers will not provide regulated data.',
    ],
  },
  {
    heading: '2. Technical controls in the HIPAA profile',
    listPreamble:
      'Set REVEALUI_COMPLIANCE_PROFILE=hipaa (or VITE_COMPLIANCE_PROFILE / NEXT_PUBLIC_COMPLIANCE_PROFILE). The profile:',
    listItems: [
      'Refuses optional cookies and does not load Speed Insights, product analytics, or Sentry session replay',
      'Signs the admin session out after 15 minutes of idle time',
      'Leaves necessary cookies (session, CSRF, role) in place so the product still works',
    ],
    paragraphs: [
      'These controls match HIPAA Security Rule addressable specifications we can enforce in software (automatic logoff, transmission of optional telemetry). They are not a substitute for a risk analysis, workforce training, or physical safeguards on your side.',
    ],
  },
  {
    heading: '3. Business Associate Agreements',
    paragraphs: [
      'A BAA is a contract, not a product flag. RevealUI Studio will execute a customer BAA only through counsel, and only for a tenant that runs the HIPAA configuration.',
      'Self-host is the honest path for PHI today. You then sign BAAs with the vendors you actually use (your database, your host, your email). Our hosted subprocessors publish their own DPA pages; a HIPAA BAA with each of them is a separate commercial step and is not in place by default.',
    ],
  },
  {
    heading: '4. Proton and everything else',
    paragraphs: [
      'Studio human mail, file shares, calendar, VPN, and operator passwords can sit on Proton (Mail, Drive, Calendar, VPN, Pass) under one Proton BAA. That BAA does not cover the product runtime.',
      'RevealUI transactional email defaults to the Gmail API. In the HIPAA profile that path is blocked. Use customer SMTP or Proton Bridge, or keep PHI out of email.',
      'Coverage is per surface. Files, database, hosting, object storage, payments, error telemetry, and support each need their own allowed vendor. Proton is one option for mail and files. It is not a blanket for Neon, Vercel, R2, Stripe, or Sentry.',
    ],
  },
  {
    heading: '5. What we will not do',
    listItems: [
      'Put "HIPAA compliant" or "HIPAA certified" on marketing pages while no BAA and no independent assessment exist',
      'Send session replay, page analytics, or Speed Insights from a HIPAA-profile deployment',
      'Accept PHI on the agency site, in a support inbox, or in an un-BAA cloud share',
    ],
  },
  {
    heading: '6. Contact',
    paragraphs: [`HIPAA and BAA questions: ${SITE.emails.support}.`],
    contactEmail: SITE.emails.support,
  },
];
