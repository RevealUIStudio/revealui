// Founder/CEO weekend quote tool: one calculator, two exits, three questions.
// No fleet math. No leftover kit / Fleet / Custom prices on this surface.

import { SITE } from './site';

export type WhoLive = 'self' | 'studio';
export type WhatWork = 'hour' | 'plan' | 'launch';
export type PlaceCount = 'one' | 'many';

export interface QuoteAnswers {
  readonly who: WhoLive;
  readonly what: WhatWork;
  readonly places: PlaceCount;
}

export type QuoteKind = 'self-host' | 'studio-hour' | 'studio-plan' | 'studio-launch' | 'intro';

export interface QuoteResult {
  readonly kind: QuoteKind;
  readonly title: string;
  readonly price?: string;
  readonly lines: readonly string[];
  readonly ownership: readonly string[];
  readonly introCta: {
    readonly label: string;
    readonly note: string;
    readonly href: string;
  };
}

export interface QuoteOption<Id extends string> {
  readonly id: Id;
  readonly label: string;
}

export const DEFAULT_QUOTE_ANSWERS: QuoteAnswers = {
  who: 'self',
  what: 'hour',
  places: 'one',
};

export const QUOTE_CALCULATOR = {
  heading: 'Get a quote.',
  body: 'Three questions. One price. No fleet math.',
  pricingHero: {
    title: 'Pricing',
    subtitle: 'Three questions. Two exits. The number that prints is the number we charge.',
  },
  questions: {
    who: {
      label: 'Who puts it live?',
      options: [
        { id: 'self', label: 'I will (developer / self-host)' },
        { id: 'studio', label: 'You will (Studio)' },
      ] as const satisfies readonly QuoteOption<WhoLive>[],
    },
    what: {
      label: 'What has to work?',
      options: [
        { id: 'hour', label: 'One hour with Joshua (debug / pair)' },
        { id: 'plan', label: 'A written plan' },
        { id: 'launch', label: 'One live flow on my accounts (site or booking + Stripe)' },
      ] as const satisfies readonly QuoteOption<WhatWork>[],
    },
    places: {
      label: 'How many places?',
      options: [
        { id: 'one', label: 'One business, one site' },
        { id: 'many', label: 'More than one (stop quoting; book an intro)' },
      ] as const satisfies readonly QuoteOption<PlaceCount>[],
    },
  },
  selfHost: {
    title: 'Self-host',
    free: 'Free: run the open stack. $0 + your infra.',
    agents:
      'If you want agents/memory: Pro $49/mo or Max $299/mo. 7-day trial. 14-day first-month refund.',
    enterprise: 'Enterprise: not in the calculator. Book an intro.',
  },
  studio: {
    title: 'Studio',
    hour: {
      title: 'Hour',
      price: '$300',
      body: 'Invoice before we start. No holdback.',
    },
    plan: {
      title: 'Written plan',
      price: '$3,500',
      body: 'Half now, half on delivery. Credits to a launch in 30 days.',
    },
    launch: {
      title: 'Launch',
      price: '$7,500',
      body: 'Half now, half when the four tests pass (your infra, your Stripe checkout, signup-to-paid, one receipted agent action). If we miss, we keep working or you get the first half back and keep the stack.',
    },
  },
  intro: {
    title: 'More than one place.',
    body: 'Stop quoting. Book an intro.',
  },
  ownership: [
    'You own the accounts and the data.',
    'If we disappear, you still have the company.',
  ] as const,
  introCta: {
    label: 'Book an intro',
    note: 'Google Calendar intro if they want a human. Meet or sit down.',
    href: SITE.urls.bookIntro,
  },
} as const;

export function resolveQuote(answers: QuoteAnswers): QuoteResult {
  const introCta = {
    label: QUOTE_CALCULATOR.introCta.label,
    note: QUOTE_CALCULATOR.introCta.note,
    href: QUOTE_CALCULATOR.introCta.href,
  };
  const ownership = [...QUOTE_CALCULATOR.ownership];

  if (answers.places === 'many') {
    return {
      kind: 'intro',
      title: QUOTE_CALCULATOR.intro.title,
      lines: [QUOTE_CALCULATOR.intro.body],
      ownership,
      introCta,
    };
  }

  if (answers.who === 'self') {
    return {
      kind: 'self-host',
      title: QUOTE_CALCULATOR.selfHost.title,
      lines: [
        QUOTE_CALCULATOR.selfHost.free,
        QUOTE_CALCULATOR.selfHost.agents,
        QUOTE_CALCULATOR.selfHost.enterprise,
      ],
      ownership,
      introCta,
    };
  }

  if (answers.what === 'hour') {
    return {
      kind: 'studio-hour',
      title: QUOTE_CALCULATOR.studio.hour.title,
      price: QUOTE_CALCULATOR.studio.hour.price,
      lines: [QUOTE_CALCULATOR.studio.hour.body],
      ownership,
      introCta,
    };
  }

  if (answers.what === 'plan') {
    return {
      kind: 'studio-plan',
      title: QUOTE_CALCULATOR.studio.plan.title,
      price: QUOTE_CALCULATOR.studio.plan.price,
      lines: [QUOTE_CALCULATOR.studio.plan.body],
      ownership,
      introCta,
    };
  }

  return {
    kind: 'studio-launch',
    title: QUOTE_CALCULATOR.studio.launch.title,
    price: QUOTE_CALCULATOR.studio.launch.price,
    lines: [QUOTE_CALCULATOR.studio.launch.body],
    ownership,
    introCta,
  };
}
