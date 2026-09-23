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
  note: 'product site defaults Who to I will / self-host and What to Proof Sprint',
};

const QUOTE_UI: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/components/landing/__tests__/QuoteCalculator.test.tsx#defaults Who to I will',
  note: 'rendered calculator defaults the Who radio to I will',
};

const QUOTE_LOCKSTEP: ClaimEntry['evidence'][number] = {
  kind: 'test',
  ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#locksteps printed numbers to public-catalog and the locked SKU trio',
  note: 'printed Free / Pro / Max / Perpetual and Consultation / Proof Sprint / Launch prices cannot drift from public-catalog',
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
    text: 'Who runs it. What you need. One price.',
    evidence: [QUOTE_RESOLVER, QUOTE_DEFAULT, QUOTE_UI],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.what.label',
    text: 'What problem are we solving?',
    evidence: [QUOTE_DEFAULT, QUOTE_UI],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.what.options[0].label',
    text: 'Consultation: diagnose the path / proof gap',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#asks exactly three questions with the two exits',
        note: 'Consultation option is the diagnose / proof-gap path, not a default Studio hour',
      },
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.body',
    proofGrade: 'outcome',
    text: 'Defaults to self-host licenses. Studio work is on the same form and books at revealuistudio.com.',
    evidence: [QUOTE_DEFAULT, QUOTE_UI, THIS_SITE],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.what.options[1].label',
    text: 'Proof Sprint: one site, one receipted action I operate',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the Studio Proof Sprint quote',
        note: 'Proof Sprint answer prints the $3,997 price',
      },
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.what.options[2].label',
    text: 'Launch: money path live on my accounts',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the Studio launch quote',
        note: 'live-flow answer prints the $14,500 launch quote',
      },
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.questions.places.options[1].label',
    text: 'More than one: book an intro',
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
    exportPath: 'QUOTE_CALCULATOR.studio.proofSprint.body',
    proofGrade: 'outcome',
    text: 'One site and one receipted action you operate. Stage B is included. Credits 100% to Launch if you start Launch within 45 days.',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the Studio Proof Sprint quote',
        note: 'Studio + Proof Sprint prints $3,997 and the 45-day Launch credit',
      },
    ],
  },
  {
    file: 'quote-calculator.ts',
    exportPath: 'QUOTE_CALCULATOR.studio.launch.body',
    proofGrade: 'outcome',
    text: 'Architecture work happens inside Launch, with a runbook and 30 days of async stabilization. Half now, half on delivery.',
    evidence: [
      {
        kind: 'test',
        ref: 'apps/marketing/app/content/__tests__/quote-calculator.test.ts#prints the Studio launch quote',
        note: 'Studio + launch prints $14,500 and half/half on delivery. No four-tests holdback.',
      },
    ],
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
