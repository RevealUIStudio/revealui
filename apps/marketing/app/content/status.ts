// Copy for /status (StatusPage.tsx). Indexed in claims-evidence.
// Probe URLs come from SITE; labels are chrome. Long sentences are claims.

import { SITE } from './site';

export interface StatusSurface {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly publicUrl: string;
  readonly mode: 'self' | 'probe' | 'link';
  readonly probeUrl?: string;
}

export const STATUS_HERO = {
  title: 'Status',
  subtitle: 'Live probe and link surface for the four RevealUI properties.',
} as const;

export const STATUS_SUMMARY = {
  pending: 'Checking current status...',
  down: 'Some surfaces are not responding',
  up: 'All probed surfaces are operational',
  body: 'This page probes the API health endpoint in your browser when you load it. It reflects what your network sees right now, not a separate uptime service. Solo-operator company: we do not run 24×7 manned monitoring you can subscribe to.',
  recheck: 'Re-check now',
} as const;

export const STATUS_SURFACES: readonly StatusSurface[] = [
  {
    id: 'marketing',
    label: 'Marketing site',
    description: 'revealui.com',
    publicUrl: 'https://revealui.com',
    mode: 'self',
  },
  {
    id: 'api',
    label: 'API',
    description: 'api.revealui.com',
    publicUrl: SITE.urls.api,
    mode: 'probe',
    probeUrl: `${SITE.urls.api}/health`,
  },
  {
    id: 'docs',
    label: 'Documentation',
    description: 'docs.revealui.com',
    publicUrl: SITE.urls.docs,
    mode: 'link',
  },
  {
    id: 'admin',
    label: 'Admin dashboard',
    description: 'admin.revealui.com',
    publicUrl: SITE.urls.admin,
    mode: 'link',
  },
] as const;

export const STATUS_MONITOR = {
  heading: 'How we monitor',
  intro:
    'RevealUI Studio is a solo-operator company. We run a single API health endpoint that this page probes when you load it. We do not currently offer email or SMS subscriptions for status changes. Honest answers about what we do and do not have:',
  worksToday:
    'The probe above reflects current API reachability from your browser. Vercel runs its own platform health checks; we receive alerts when their checks fail.',
  watching:
    'A separate public uptime history with subscribable incident channels is queued for after we have paying customers. Until then, this live-probe page is the honest interim.',
  missing:
    'A 24×7 on-call rotation. Multi-region failover. A separate paid status page domain. We will publish these on this page when they ship, not before.',
} as const;

export const STATUS_INCIDENTS = {
  heading: 'Incident history',
  body: 'No incidents have been disclosed here yet. When one occurs, we will post a brief notice with timestamps, impact, root cause (once known), and remediation. We commit to disclosing real incidents rather than hiding them.',
} as const;

export const STATUS_OUTAGE = {
  heading: 'Are you experiencing an outage?',
  body: 'If this page shows all surfaces operational but you are still seeing issues, the problem is probably between your network and ours, or specific to a feature this page does not probe yet. Email support with the URL you hit, the time you first saw the issue, and any error message. We treat outage reports as higher priority than standard support email.',
  security:
    'For confirmed security incidents, follow the security policy instead. That channel has different SLAs.',
} as const;

export const STATUS_BADGES = {
  self: 'Operational (you are here)',
  link: 'Visit to verify',
  pending: 'Checking…',
  unreachable: 'Unreachable',
} as const;
