// Content for /philosophy. Locked verbatim to
// docs/marketing/06-copy-corpus.md §4.6 "The manifesto block".
// If this file drifts from the corpus, this file is wrong and gets
// fixed here first (per the corpus §0 authority rule).

export const PHILOSOPHY = {
  eyebrow: 'Why RevealUI exists',
  h1: 'Software that compounds.',
  sections: [
    {
      lead: true,
      body: "Human progress accelerates when the outputs of today's work become the inputs of tomorrow's work.",
    },
    {
      body: 'Most software effort evaporates. The project ships, the lessons scatter, and the next project starts from zero. Tools that promise productivity make the work faster. They do not make the next project start further ahead.',
    },
    {
      body: 'RevealUI is built for compounding. Five primitives, People, Content, Offers, Payments, and Agents, are a contract you implement once and reuse in every product you ship. A deployment that works becomes a RevealUI Fleet kit, branded and domain-locked for the next client you serve. An agent that works in your business keeps its memory in a store you own, so the record of your work is an asset, not an afterthought.',
    },
    {
      body: "Large organizations buy this kind of accumulation with headcount. RevealUI packages it as software you self-host, so a small team can build on yesterday's work instead of repeating it.",
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
