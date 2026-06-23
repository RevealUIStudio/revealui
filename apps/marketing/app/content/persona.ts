// Sourced from: app/components/landing/Persona.tsx (Phase 1c extraction).
// Per docs/lanes/marketing-overhaul/plan.md §4.4.
// 2026-05-23: founder-first plain-language rewrite of section heading + card
//   copy (owner-directed). Jargon (procurement review, identity gates, RBAC +
//   ABAC, hash-chained, runtime) translated into outcomes founders recognize.

export const PERSONA_SECTION = {
  eyebrow: "Who it's for",
  heading:
    'For teams putting agents in front of customers who still have to pass a security review.',
} as const;

export const PERSONA_CARD = {
  label: 'What this team needs before they can charge customers',
  quote:
    'You’ve got a working AI demo. Then your first serious customer asks the hard questions: who can see this data, who can shut an agent down at 3am, and can you prove everything it did? You need answers before you can charge them, and you shouldn’t have to rebuild what you’ve already shipped to get there.',
  checklist: [
    'An audit trail of every action, by people and by agents, that you can prove was not edited after the fact',
    'One set of permission rules covering your team, your agents, and your service accounts',
    'GDPR consent, deletion, and anonymization built into the data model',
    'Stripe billing that catches the payment events most apps quietly drop',
    'Source-visible code your customer’s security team can actually read and review',
  ],
  footer: {
    prefix: 'Also a fit for',
    sprawl: 'teams escaping backend-platform sprawl',
    sprawlNote: '(four or five separate backend services), and',
    studios: 'studios + consultancies',
    studiosNote:
      'white-labeling one runtime across N customers without re-licensing N SaaS stacks.',
  },
} as const;
