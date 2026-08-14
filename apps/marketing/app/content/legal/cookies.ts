import { SITE } from '../site';
import type { LegalSection } from './privacy';

export const COOKIES_META = {
  title: 'Cookie Policy',
  lastUpdated: 'August 13, 2026',
  intro:
    'This Cookie Policy describes the cookies and similar technologies used on revealui.com, admin.revealui.com, api.revealui.com, and docs.revealui.com. It sits next to the Privacy Policy. Optional cookies stay off until you accept them. A HIPAA configuration never turns optional cookies on.',
  notice: {
    variant: 'info' as const,
    title: 'Status: drafted in good faith, pending counsel review',
    body: 'This page describes the cookies and similar technologies we actually use today. The wording has not yet been reviewed by an attorney. Questions:',
  },
} as const;

export const COOKIES_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. How we ask',
    paragraphs: [
      'On your first visit we show a banner with Accept all, Reject all, and Customize. Reject is as easy as Accept. We honor Global Privacy Control and Do Not Track as a reject of optional categories. You can change the choice later from Cookie settings in the footer. We remember the choice for six months.',
    ],
  },
  {
    heading: '2. Cookies we set',
    listPreamble:
      'Necessary cookies run to provide the service. They do not require consent under the ePrivacy rules we follow.',
    listItems: [
      'revealui-session (necessary): set on sign-in to keep you authenticated. httpOnly, Secure in production, SameSite=Lax. Up to 7 days (1 day when MFA is in use).',
      'revealui-role (necessary): a role hint so the admin proxy can route admin-only paths. httpOnly, Secure in production, SameSite=Lax.',
      'revealui-must-rotate (necessary): set when a password must be changed before the session continues. Host-only.',
      'revealui-csrf (necessary): double-submit CSRF token for state-changing requests. Readable by JavaScript on purpose. SameSite=Strict. 24 hours.',
      'revealui-node-id (necessary): stable identifier for collaborative editing. httpOnly, Secure in production, SameSite=Lax. 1 year.',
      'revealui-cookie-consent (necessary): stores this cookie choice so we do not ask every page load. First-party, SameSite=Lax. 180 days.',
    ],
  },
  {
    heading: '3. Optional tools (off until you accept)',
    listItems: [
      'Vercel Speed Insights: first-party performance timings (Core Web Vitals). Loaded only after analytics consent, and never in a HIPAA configuration.',
      'Product analytics: a Plausible-compatible beacon with the event name, page URL, and referrer. No advertising cookies and no user id. Sent only after analytics consent, and never when Do Not Track is set.',
      'Sentry error tracking: crash diagnostics. Session replay and performance tracing load only after analytics consent. A HIPAA configuration keeps Sentry replay and tracing off.',
    ],
    paragraphs: [
      'We do not use advertising cookies, marketing pixels, or cross-site profiling. The Marketing category exists in the banner so a future tool cannot ship without an explicit accept.',
    ],
  },
  {
    heading: '4. HIPAA configuration',
    paragraphs: [
      'Set REVEALUI_COMPLIANCE_PROFILE=hipaa on a deployment that may hold protected health information. That profile refuses optional cookies and third-party browser telemetry, blocks the default Gmail API mail path, and signs the admin out after 15 minutes of idle time. Proton Mail is one allowed email vendor, not a blanket for the rest of the stack. See the HIPAA page.',
    ],
  },
  {
    heading: '5. Contact',
    paragraphs: [`Questions about cookies: ${SITE.emails.support}.`],
    contactEmail: SITE.emails.support,
  },
];
