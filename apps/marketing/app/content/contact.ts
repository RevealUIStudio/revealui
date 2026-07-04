// Sourced from: app/routes/ContactPage.tsx (Phase 1, no copy changes). Per the internal marketing-overhaul plan §4.4.

import { SITE } from './site';

export interface ContactMethod {
  readonly title: string;
  readonly body: string;
  readonly linkLabel: string;
  readonly href: string;
  readonly external?: boolean;
  readonly isEmail?: boolean;
}

export const CONTACT_HERO = {
  title: 'Get in touch',
  subtitle:
    'Questions about RevealUI? Interested in Enterprise or custom pricing? We would love to hear from you.',
} as const;

export const CONTACT_METHODS: readonly ContactMethod[] = [
  {
    title: 'Community',
    body: 'Join the conversation on',
    linkLabel: 'GitHub Discussions',
    href: SITE.urls.repoDiscussions,
    external: true,
  },
  {
    title: 'Support',
    body: '',
    linkLabel: SITE.emails.support,
    href: `mailto:${SITE.emails.support}`,
    isEmail: true,
  },
  {
    title: 'Bug Reports',
    body: '',
    linkLabel: 'GitHub Issues',
    href: SITE.urls.repoIssues,
    external: true,
  },
] as const;
