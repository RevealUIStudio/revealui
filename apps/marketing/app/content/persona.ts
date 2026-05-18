// Sourced from: app/components/landing/Persona.tsx (Phase 1c, no copy changes).
// Per docs/lanes/marketing-overhaul/plan.md §4.4.

export const PERSONA_SECTION = {
  eyebrow: "Who it's for",
  heading: 'Founders shipping AI products who need governance from day one.',
} as const;

export const PERSONA_CARD = {
  label: 'What this team needs before they can charge customers',
  quote:
    'You have a working agent demo. Now your first procurement review wants audit trails, identity gates, and a story for who can revoke an agent at 3am — without rebuilding the runtime to get there.',
  checklist: [
    'Hash-chained audit log of every action by every human and every agent — provable, not just observable',
    'One RBAC + ABAC policy plane covering humans, agents, and service accounts',
    'GDPR consent + deletion + anonymization scaffolded into the data model',
    'Stripe webhook reconciliation that catches the events most apps lose silently',
    'Source-visible Pro packages on Fair Source — auditable for procurement and security review',
  ],
  footer: {
    prefix: 'Also a fit for',
    sprawl: 'teams escaping backend-platform sprawl',
    sprawlNote: '(Convex + Supabase + Clerk + Trigger), and',
    studios: 'studios + consultancies',
    studiosNote:
      'white-labeling one runtime across N customers without re-licensing N SaaS stacks.',
  },
} as const;
