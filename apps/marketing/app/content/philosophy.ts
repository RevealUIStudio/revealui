// Content for /philosophy. 2026-09-11 Auditor voice: drop the manifesto
// accelerate lead. Keep self-host accumulation that the code actually does.
//
// claims-ratchet 2026-08-30: compounding copy no longer promotes a Fleet kit
// or RevForge as a public get-started path.

export const PHILOSOPHY = {
  eyebrow: 'Why RevealUI exists',
  h1: 'Self-host one runtime. Reuse it on the next product.',
  sections: [
    {
      lead: true,
      body: 'RevealUI packages people, content, offers, payments, and agents as software you self-host. A deployment that works stays yours to run again.',
    },
    {
      body: 'Most stacks scatter after ship. The next product starts from zero: new auth, new admin, new billing glue.',
    },
    {
      body: 'Five primitives are a contract you implement once. An agent that works in your business keeps its memory in a store you own.',
    },
    {
      body: 'You still pay for your own Postgres and compute. The source is in the public repo.',
    },
    {
      footer: true,
      body: 'Used in production by the team that maintains it.',
    },
  ],
  cta: {
    primary: { label: 'Start free', href: '/pricing' },
    secondary: { label: 'See it on GitHub', href: 'https://github.com/RevealUIStudio/revealui' },
  },
} as const;
