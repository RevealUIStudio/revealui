import {
  BILLING,
  CLI_CREATE,
  LEGAL_REFUND_CONTENT,
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
  note: 'product site defaults Who to I will / self-host',
};

const QUOTE_UI: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/components/landing/__tests__/QuoteCalculator.test.tsx#defaults Who to I will',
  note: 'rendered calculator defaults the Who radio to I will',
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
    exportPath: 'QUOTE_CALCULATOR.body',
    proofGrade: 'outcome',
    text: 'Three questions. One price. No fleet math.',
    evidence: [QUOTE_RESOLVER, QUOTE_DEFAULT, QUOTE_UI],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.pricingHero.subtitle',
    proofGrade: 'outcome',
    text: 'Three questions. Two exits. The number that prints is the number we charge.',
    evidence: [QUOTE_RESOLVER, QUOTE_UI],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.who.options[0].label',
    text: 'I will (developer / self-host)',
    evidence: [QUOTE_DEFAULT, QUOTE_UI, SELF_HOST],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.what.options[0].label',
    text: 'One hour with Joshua (debug / pair)',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the Studio hour quote',
        note: 'hour answer prints the $300 Studio hour quote',
      },
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.what.options[2].label',
    text: 'One live flow on my accounts (site or booking + Stripe)',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the Studio launch quote',
        note: 'live-flow answer prints the $7,500 launch quote',
      },
      BILLING,
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.places.options[1].label',
    text: 'More than one (stop quoting; book an intro)',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#stops quoting and books an intro when there is more than one place',
        note: 'places=many stops quoting on both exits',
      },
      BOOK_INTRO,
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.selfHost.free',
    proofGrade: 'outcome',
    text: 'Free: run the open stack. $0 + your infra.',
    evidence: [LICENSE_MIT, SELF_HOST, CLI_CREATE, QUOTE_RESOLVER],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.selfHost.agents',
    proofGrade: 'outcome',
    text: 'If you want agents/memory: Pro $49/mo or Max $299/mo. 7-day trial. 14-day first-month refund.',
    evidence: [PRICING_FALLBACKS, TRIAL, LEGAL_REFUND_CONTENT, QUOTE_RESOLVER],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.selfHost.enterprise',
    proofGrade: 'behavior',
    text: 'Enterprise: not in the calculator. Book an intro.',
    evidence: [QUOTE_RESOLVER, BOOK_INTRO],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.studio.hour.body',
    proofGrade: 'outcome',
    text: 'Invoice before we start. No holdback.',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the Studio hour quote',
        note: 'Studio + hour prints $300 and the invoice/no-holdback line',
      },
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.studio.plan.body',
    proofGrade: 'outcome',
    text: 'Half now, half on delivery. Credits to a launch in 30 days.',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the Studio written-plan quote',
        note: 'Studio + plan prints $3,500 and the half/half credit line',
      },
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.studio.launch.body',
    proofGrade: 'outcome',
    text: 'Half now, half when the four tests pass (your infra, your Stripe checkout, signup-to-paid, one receipted agent action). If we miss, we keep working or you get the first half back and keep the stack.',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the Studio launch quote',
        note: 'Studio + launch prints $7,500 and the four-test holdback line',
      },
      BILLING,
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.intro.body',
    proofGrade: 'outcome',
    text: 'Stop quoting. Book an intro.',
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
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.introCta.note',
    proofGrade: 'behavior',
    text: 'Google Calendar intro if they want a human. Meet or sit down.',
    evidence: [BOOK_INTRO, QUOTE_INTRO, THIS_SITE],
  },
];
