// Product-site quote tool: one calculator, two exits, three questions.
// Same numbers as revealuistudio.com. This site defaults Who to I will.

import {
  ARCHITECTURE_REVIEW_PRICE,
  CONSULTING_HOUR_PRICE,
  LAUNCH_PACKAGE_PRICE,
} from '@revealui/contracts/public-catalog';
import { PERPETUAL_PRICE_FALLBACKS, SUBSCRIPTION_PRICE_FALLBACKS } from '../lib/pricing-fallbacks';
import { SITE } from './site';

export type WhoLive = 'self' | 'studio';
export type WhatWork = 'hour' | 'plan' | 'launch';
export type PlaceCount = 'one' | 'many';

export interface QuoteAnswers {
  readonly who: WhoLive;
  readonly what: WhatWork;
  readonly places: PlaceCount;
}

export type QuoteKind = 'self-host' | 'studio' | 'intro';

export interface QuoteSkuLine {
  readonly id: WhatWork;
  readonly title: string;
  readonly price: string;
  readonly body: string;
  readonly highlighted: boolean;
}

export interface QuoteCta {
  readonly label: string;
  readonly href: string;
}

export interface QuoteResult {
  readonly kind: QuoteKind;
  readonly title: string;
  readonly price?: string;
  readonly lines: readonly string[];
  readonly skus?: readonly QuoteSkuLine[];
  readonly ownership: readonly string[];
  readonly startFreeCta?: QuoteCta;
  readonly introCta: QuoteCta & { readonly note: string };
}

export interface QuoteOption<Id extends string> {
  readonly id: Id;
  readonly label: string;
}

const FREE_PRICE = SUBSCRIPTION_PRICE_FALLBACKS.free.price;
const PRO_PRICE = SUBSCRIPTION_PRICE_FALLBACKS.pro.price;
const MAX_PRICE = SUBSCRIPTION_PRICE_FALLBACKS.max.price;
const PERPETUAL_PRICE = PERPETUAL_PRICE_FALLBACKS['Pro Perpetual'].price;

export const DEFAULT_QUOTE_ANSWERS: QuoteAnswers = {
  who: 'self',
  what: 'hour',
  places: 'one',
};

export const QUOTE_CALCULATOR = {
  heading: 'Three questions. A price you can read.',
  body: 'This calculator defaults to product licenses. Studio work is quoted here too and booked on revealuistudio.com.',
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
        { id: 'plan', label: 'Architecture artifact bundle and review' },
        { id: 'launch', label: 'One live flow on my accounts' },
      ] as const satisfies readonly QuoteOption<WhatWork>[],
    },
    places: {
      label: 'How many places?',
      options: [
        { id: 'one', label: 'One business, one place' },
        { id: 'many', label: 'More than one (stop quoting; book an intro)' },
      ] as const satisfies readonly QuoteOption<PlaceCount>[],
    },
  },
  selfHost: {
    title: 'Self-host',
    free: `Free: ${FREE_PRICE} + your infra. Start free, or run \`npx create-revealui\`.`,
    agents: `Pro ${PRO_PRICE}/mo or Max ${MAX_PRICE}/mo. 7-day trial.`,
    perpetual: `Optional one-time: Pro Perpetual ${PERPETUAL_PRICE}.`,
    enterprise: 'Enterprise: not in the calculator. Contact sales or book an intro.',
  },
  studio: {
    title: 'Studio',
    hour: {
      title: 'Hour',
      price: CONSULTING_HOUR_PRICE,
      body: 'Invoice before we start. No holdback.',
    },
    plan: {
      title: 'Architecture artifact bundle and review',
      price: ARCHITECTURE_REVIEW_PRICE,
      body: 'The prototype is inside the bundle. Half now, half on delivery. Credits to a launch in 30 days.',
    },
    launch: {
      title: 'Launch',
      price: LAUNCH_PACKAGE_PRICE,
      body: 'Half now, half on delivery.',
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
  startFreeCta: {
    label: 'Start free',
    href: SITE.urls.signup,
  },
  introCta: {
    label: 'Book a 30-minute intro',
    note: 'Google Calendar / Meet or sit down.',
    href: SITE.urls.bookIntro,
  },
} as const;

function studioSkus(highlighted: WhatWork): readonly QuoteSkuLine[] {
  return [
    {
      id: 'hour',
      title: QUOTE_CALCULATOR.studio.hour.title,
      price: QUOTE_CALCULATOR.studio.hour.price,
      body: QUOTE_CALCULATOR.studio.hour.body,
      highlighted: highlighted === 'hour',
    },
    {
      id: 'plan',
      title: QUOTE_CALCULATOR.studio.plan.title,
      price: QUOTE_CALCULATOR.studio.plan.price,
      body: QUOTE_CALCULATOR.studio.plan.body,
      highlighted: highlighted === 'plan',
    },
    {
      id: 'launch',
      title: QUOTE_CALCULATOR.studio.launch.title,
      price: QUOTE_CALCULATOR.studio.launch.price,
      body: QUOTE_CALCULATOR.studio.launch.body,
      highlighted: highlighted === 'launch',
    },
  ];
}

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
        QUOTE_CALCULATOR.selfHost.perpetual,
        QUOTE_CALCULATOR.selfHost.enterprise,
      ],
      ownership,
      startFreeCta: {
        label: QUOTE_CALCULATOR.startFreeCta.label,
        href: QUOTE_CALCULATOR.startFreeCta.href,
      },
      introCta,
    };
  }

  return {
    kind: 'studio',
    title: QUOTE_CALCULATOR.studio.title,
    lines: studioSkus(answers.what).flatMap((sku) => [`${sku.title} ${sku.price}`, sku.body]),
    skus: studioSkus(answers.what),
    ownership,
    introCta,
  };
}
