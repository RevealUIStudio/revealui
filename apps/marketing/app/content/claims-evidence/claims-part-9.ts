import {
  CLI_CREATE,
  LICENSE_MIT,
  PRICING_FALLBACKS,
  SELF_HOST,
  THIS_SITE,
  TRIAL,
} from './shared-refs.js';
import type { ClaimEntry } from './types.js';

const QUOTE_RESOLVER: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the self-host quote when Who is I will',
  note: 'resolveQuote prints the self-host SKUs when Who is I will',
};

const QUOTE_DEFAULT: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#defaults Who to I will (self-host) on this site',
  note: 'product site defaults Who to self-host and does not default a Studio SKU',
};

const QUOTE_UI: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/components/landing/__tests__/QuoteCalculator.test.tsx#defaults Who to I will',
  note: 'rendered calculator defaults the Who radio to I will',
};

const QUOTE_LOCKSTEP: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#locksteps printed product license numbers and omits Studio SKU prices',
  note: 'printed Free / Pro / Max / Perpetual prices stay on the product calculator; Studio SKU prices do not',
};

const QUOTE_BOUNDARY: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#asks who runs it and how many sites, with Studio as an outbound path',
  note: 'product calculator names the Studio path and does not offer Studio SKUs as plans',
};

const QUOTE_STUDIO_ROUTE: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#routes Studio implementation to revealuistudio.com without Studio prices',
  note: 'Studio answers route to revealuistudio.com/#calculator and print no Studio prices',
};

const STUDIO_QUOTE_URL: ClaimEntry['evidence'][number] = {
  kind: 'url',
  ref: 'https://revealuistudio.com/#calculator',
  note: 'Studio quote and booking path lives on the Studio domain',
};

const QUOTE_INTRO: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#always carries ownership lines and the Google Calendar intro',
  note: 'every quote carries ownership lines and the Google Calendar intro href',
};

const BOOK_INTRO: ClaimEntry['evidence'][number] = {
  kind: 'url',
  ref: 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ21UZVcuYp7yO32rZmhyUvZFDJcvles81E9edGNFwSUP8SHEVzGvq0gKgNFo7q04YS5i-12ZE5P',
  note: 'founder intro is Google Calendar appointments only',
};

export const claimsPart9: readonly ClaimEntry[] = [
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.heading',
    proofGrade: 'outcome',
    text: 'Who runs it. What you need. One product price.',
    evidence: [QUOTE_RESOLVER, QUOTE_DEFAULT, QUOTE_UI, QUOTE_BOUNDARY],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.bodies.home',
    proofGrade: 'outcome',
    text: 'Self-host licenses are the default on RevealUI. For implementation, open the separate RevealUI Studio quote and booking path.',
    evidence: [
      QUOTE_BOUNDARY,
      THIS_SITE,
      {
        kind: 'test',
        ref: 'apps/marketing/app/components/landing/__tests__/QuoteCalculator.test.tsx#shows the home Studio boundary as an outbound quote link',
        note: 'home quote intro keeps licenses on RevealUI and points implementation at Studio',
      },
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.bodies.pricing',
    proofGrade: 'outcome',
    text: 'This calculator covers Free, Pro, Max, and Pro Perpetual licenses. For Studio Consultation, Proof Sprint, or Launch, visit revealuistudio.com.',
    evidence: [
      QUOTE_BOUNDARY,
      THIS_SITE,
      STUDIO_QUOTE_URL,
      {
        kind: 'test',
        ref: 'apps/marketing/app/components/landing/__tests__/QuoteCalculator.test.tsx#shows the pricing Studio boundary as an outbound quote link',
        note: 'pricing quote intro names the license catalog and sends Studio outcomes to revealuistudio.com',
      },
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.who.options[1].label',
    text: 'I need Studio implementation',
    evidence: [QUOTE_BOUNDARY, QUOTE_STUDIO_ROUTE],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.places.options[1].label',
    text: 'More than one: book an intro',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#stops quoting and books an intro when there is more than one place',
        note: 'self-host plus more than one site stops quoting and books an intro',
      },
      BOOK_INTRO,
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.selfHost.free',
    proofGrade: 'outcome',
    text: 'Free: $0 + your infra. Start free, or run `npx create-revealui@latest`.',
    evidence: [LICENSE_MIT, SELF_HOST, CLI_CREATE, QUOTE_RESOLVER],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.selfHost.agents',
    proofGrade: 'outcome',
    text: 'Pro $49/mo or Max $99/mo. 7-day trial.',
    evidence: [PRICING_FALLBACKS, TRIAL, QUOTE_LOCKSTEP, QUOTE_RESOLVER],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.selfHost.perpetual',
    proofGrade: 'outcome',
    text: 'Optional one-time: Pro Perpetual $1,499.',
    evidence: [PRICING_FALLBACKS, QUOTE_LOCKSTEP, QUOTE_RESOLVER],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.selfHost.enterprise',
    proofGrade: 'behavior',
    text: 'Enterprise: not in the calculator. Contact sales or book an intro.',
    evidence: [QUOTE_RESOLVER, BOOK_INTRO],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.studioPath.body',
    proofGrade: 'outcome',
    text: 'Open the separate RevealUI Studio quote. Studio lists Consultation, Proof Sprint, and Launch on its own domain.',
    evidence: [QUOTE_STUDIO_ROUTE, STUDIO_QUOTE_URL],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.intro.body',
    proofGrade: 'outcome',
    text: 'The calculator stops here. Book a 30-minute intro to scope it.',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#stops quoting and books an intro when there is more than one place',
        note: 'more than one place stops quoting',
      },
      BOOK_INTRO,
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.introCta.note',
    proofGrade: 'behavior',
    text: 'Google Calendar / Google Meet.',
    evidence: [QUOTE_INTRO, BOOK_INTRO],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.ownership[0]',
    proofGrade: 'outcome',
    text: 'You own the accounts and the data.',
    evidence: [SELF_HOST, LICENSE_MIT, QUOTE_INTRO],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.ownership[1]',
    proofGrade: 'outcome',
    text: 'If we disappear, you still have the company.',
    evidence: [SELF_HOST, LICENSE_MIT, QUOTE_INTRO],
  },
];
